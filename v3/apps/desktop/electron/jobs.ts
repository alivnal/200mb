import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { basename, dirname, extname, join } from 'node:path';
import { rm, stat, statfs, writeFile } from 'node:fs/promises';
import {
  CompressionCancelledError,
  MAX_BITRATE_RETRIES,
  MAX_OUTPUT_BYTES,
  adjustBitrateForOvershoot,
  blueprintForDegradationPass,
  deleteSegmentsToKeepSegments,
  mergeTrimSegments,
  validateDeleteSegments,
  type BitrateCalculation,
  type TrimSegment,
  type VideoProbeMetadata,
} from '../../../../v4/apps/web/lib/squish-core';
import { DEGRADATION_PASSES } from '../../../../v4/apps/web/lib/squish-core/bitrate';
import type { NativeJob, NativeJobProgress } from './contracts';

export interface ProbeResult extends VideoProbeMetadata {
  /** Stream index of the main picture (cover art is skipped). */
  videoStream: number;
  videoCodec: string;
  /** Stream index of the first audio track, or null. */
  audioStream: number | null;
  /** Codec parameters that must match for clips to be joined without re-encoding. */
  copySignature: string;
}

export interface JobOutput {
  /** File holding the result: a temp encode, or the source when no encode was needed. */
  path: string;
  filename: string;
  originalSize: number;
  compressedSize: number;
  skippedEncode: boolean;
  encodeTimeMs: number;
  clipCount?: number;
  trimSegmentCount?: number;
}

/** What one FFmpeg run reads: inputs plus a filtergraph ending in [srcv]. */
interface EncodeSource {
  inputs: string[];
  filter: string;
  /** Audio to map: a filtergraph label, an input stream, or none. */
  audio: string | null;
  durationSeconds: number;
  sourceBytes: number;
}

type ProgressReporter = (progress: Omit<NativeJobProgress, 'jobId'>) => void;

interface FfprobeStream {
  index: number;
  codec_type?: string;
  codec_name?: string;
  profile?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
  disposition?: { attached_pic?: number };
  tags?: { rotate?: string };
  side_data_list?: Array<{ rotation?: number }>;
}

const MERGE_MAX_DIMENSION = 1920;
const MAX_OUTPUT_DIMENSION = 1920;
const MERGE_FPS = 30;
// One encode attempt at a time plus the previous one's file during the size check.
const REQUIRED_FREE_BYTES = 2 * MAX_OUTPUT_BYTES + 100 * 1024 * 1024;
const KILL_GRACE_MS = 3000;
const MIN_CAPPED_VIDEO_BPS = 300_000;

export class FfmpegJobs {
  private activeProcess: ChildProcessWithoutNullStreams | null = null;
  private cancelled = false;

  constructor(private readonly binary: (name: 'ffmpeg' | 'ffprobe') => string) {}

  cancel(): void {
    this.cancelled = true;
    const child = this.activeProcess;
    if (!child) return;
    child.kill('SIGTERM');
    // FFmpeg can hang on a stalled input; make sure it goes.
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, KILL_GRACE_MS).unref();
  }

  async probe(path: string): Promise<ProbeResult> {
    const stdout = await this.capture('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path]);
    const metadata = JSON.parse(stdout) as {
      format?: { duration?: string; size?: string };
      streams?: FfprobeStream[];
    };
    const streams = metadata.streams ?? [];
    const video = streams.find((s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1);
    const audio = streams.find((s) => s.codec_type === 'audio') ?? null;
    const duration = Number(metadata.format?.duration);
    if (!video || !Number.isFinite(duration) || duration <= 0) {
      throw new Error('The selected file does not contain a readable video stream.');
    }

    // FFmpeg rotates frames on decode, so report the size as it will be shown.
    const rotation = Math.abs(Number(video.tags?.rotate ?? video.side_data_list?.find((d) => d.rotation != null)?.rotation ?? 0)) % 180;
    const [width, height] = rotation === 90 ? [video.height ?? 0, video.width ?? 0] : [video.width ?? 0, video.height ?? 0];

    return {
      name: basename(path),
      size: Number(metadata.format?.size) || (await stat(path)).size,
      duration,
      width,
      height,
      videoStream: video.index,
      videoCodec: video.codec_name ?? '',
      audioStream: audio?.index ?? null,
      copySignature: JSON.stringify([
        video.codec_name, video.profile, video.width, video.height, video.pix_fmt, video.r_frame_rate, rotation,
        audio?.codec_name ?? null, audio?.sample_rate ?? null, audio?.channels ?? null,
      ]),
    };
  }

  async run(job: NativeJob, outputPath: string, report: ProgressReporter): Promise<JobOutput> {
    this.cancelled = false;
    report({ stage: 'preparing', ratio: 0 });

    if (job.kind === 'compress') {
      const probe = await this.probe(job.path);
      const extension = extname(job.path);
      const base = basename(job.path, extension);
      if (probe.size <= MAX_OUTPUT_BYTES) {
        return {
          path: job.path,
          filename: `${base}_compressed${extension}`,
          originalSize: probe.size,
          compressedSize: probe.size,
          skippedEncode: true,
          encodeTimeMs: 0,
        };
      }
      return this.encode(compressSource(job.path, probe), outputPath, `${base}_compressed.mp4`, report);
    }

    if (job.kind === 'trim') {
      const probe = await this.probe(job.path);
      const deleteSegments = mergeTrimSegments(job.deleteSegments);
      const invalid = validateDeleteSegments(deleteSegments, probe.duration);
      if (invalid) throw new Error(`The sections to delete are not valid (${invalid}).`);
      const keeps = deleteSegmentsToKeepSegments(deleteSegments, probe.duration);
      const base = basename(job.path, extname(job.path));
      const output = await this.encode(trimSource(job.path, probe, keeps), outputPath, `${base}_trimmed_compressed.mp4`, report);
      return { ...output, originalSize: probe.size, trimSegmentCount: deleteSegments.length };
    }

    if (job.paths.length < 2) throw new Error('Select at least two videos to merge.');
    const probes: ProbeResult[] = [];
    for (const path of job.paths) {
      this.throwIfCancelled();
      probes.push(await this.probe(path));
      report({ stage: 'preparing', ratio: probes.length / job.paths.length });
    }
    const base = basename(job.paths[0], extname(job.paths[0]));
    const filename = `${base}_merged_compressed.mp4`;
    const copied = await this.mergeByCopy(job.paths, probes, outputPath, filename, report);
    const output = copied ?? (await this.encode(mergeSource(job.paths, probes), outputPath, filename, report));
    return { ...output, clipCount: job.paths.length };
  }

  /**
   * Clips from the same camera or export share codec settings and can be joined
   * as they are: lossless and seconds instead of minutes. Returns null when the
   * clips differ, the result would be over the cap, or the join looks wrong.
   */
  private async mergeByCopy(
    paths: string[],
    probes: ProbeResult[],
    outputPath: string,
    filename: string,
    report: ProgressReporter,
  ): Promise<JobOutput | null> {
    const totalBytes = probes.reduce((sum, probe) => sum + probe.size, 0);
    const signatures = new Set(probes.map((probe) => probe.copySignature));
    const copyableCodec = ['h264', 'hevc'].includes(probes[0].videoCodec);
    if (signatures.size !== 1 || !copyableCodec || totalBytes > MAX_OUTPUT_BYTES * 0.98) return null;

    await this.assertFreeSpace(outputPath);
    const listPath = join(dirname(outputPath), `${basename(outputPath, '.mp4')}-concat.txt`);
    const list = paths.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join('\n');
    const expectedDuration = probes.reduce((sum, probe) => sum + probe.duration, 0);
    const started = Date.now();
    try {
      await writeFile(listPath, `${list}\n`, 'utf8');
      await this.runFfmpeg(
        [
          '-y', '-hide_banner', '-loglevel', 'error', '-nostats', '-progress', 'pipe:1',
          '-f', 'concat', '-safe', '0', '-i', listPath,
          '-map', `0:v:0`, '-map', '0:a:0?', '-c', 'copy',
          '-movflags', '+faststart', outputPath,
        ],
        expectedDuration,
        (ratio) => report({ stage: 'encoding', ratio }),
      );
      const merged = await this.probe(outputPath);
      const tolerance = 0.5 + 0.25 * paths.length;
      if (merged.size > MAX_OUTPUT_BYTES || Math.abs(merged.duration - expectedDuration) > tolerance) {
        await rm(outputPath, { force: true });
        return null;
      }
      return {
        path: outputPath,
        filename,
        originalSize: totalBytes,
        compressedSize: merged.size,
        skippedEncode: true,
        encodeTimeMs: Date.now() - started,
      };
    } catch (error) {
      await rm(outputPath, { force: true });
      if (error instanceof CompressionCancelledError) throw error;
      // Codec details the probe cannot see can still break a copy join; encode instead.
      return null;
    } finally {
      await rm(listPath, { force: true });
    }
  }

  /** Encodes down the degradation ladder until the file fits under the cap. */
  private async encode(
    source: EncodeSource,
    outputPath: string,
    filename: string,
    report: ProgressReporter,
  ): Promise<JobOutput> {
    await this.assertFreeSpace(outputPath);
    // Most jobs fit on the first try, so it fills most of the bar; a retry
    // fills most of what is left instead of the bar sitting still.
    let progressDone = 0;
    let progress = 0;
    // Every tier already aims its bitrate at the size cap, so the best tier is
    // tried first; the shared start-tier guess skips tiers by input size and
    // would shrink a short 4K clip to 360p that fits easily at full quality.
    let tier = 0;
    let retriesLeft = MAX_BITRATE_RETRIES;
    // Never spend more bits than the source has: a small or already-compressed
    // input would otherwise come out larger than it went in.
    const sourceBps = (source.sourceBytes * 8) / Math.max(source.durationSeconds, 1);
    const capToSource = (plan: BitrateCalculation): BitrateCalculation => ({
      ...plan,
      videoBitrateBps: Math.max(MIN_CAPPED_VIDEO_BPS, Math.min(plan.videoBitrateBps, sourceBps - plan.audioBitrateBps)),
    });
    let blueprint = capToSource(blueprintForDegradationPass(tier, source.durationSeconds));
    let encodeTimeMs = 0;

    try {
      while (tier < DEGRADATION_PASSES.length) {
        this.throwIfCancelled();
        await rm(outputPath, { force: true });
        const started = Date.now();
        await this.runFfmpeg(encodeArgs(source, blueprint, outputPath), source.durationSeconds, (ratio) => {
          progress = progressDone + (1 - progressDone) * 0.9 * ratio;
          report({ stage: 'encoding', ratio: progress });
        });
        encodeTimeMs += Date.now() - started;
        progressDone = progress;
        report({ stage: 'finalizing', ratio: 0.5 });
        const { size } = await stat(outputPath);
        if (size <= MAX_OUTPUT_BYTES) {
          return {
            path: outputPath,
            filename,
            originalSize: source.sourceBytes,
            compressedSize: size,
            skippedEncode: false,
            encodeTimeMs,
          };
        }

        if (retriesLeft > 0) {
          blueprint = adjustBitrateForOvershoot(blueprint, size);
          retriesLeft -= 1;
          continue;
        }
        tier += 1;
        retriesLeft = MAX_BITRATE_RETRIES;
        if (tier < DEGRADATION_PASSES.length) blueprint = capToSource(blueprintForDegradationPass(tier, source.durationSeconds));
      }
      throw new Error('This video cannot be compressed below 200 MB. Try a shorter video or a lower-resolution source.');
    } catch (error) {
      await rm(outputPath, { force: true });
      throw error;
    }
  }

  private async assertFreeSpace(outputPath: string): Promise<void> {
    const { bavail, bsize } = await statfs(dirname(outputPath));
    if (bavail * bsize < REQUIRED_FREE_BYTES) {
      throw new Error('Not enough free disk space. Free up at least 500 MB and try again.');
    }
  }

  private capture(name: 'ffmpeg' | 'ffprobe', args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.binary(name), args, { windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
        stderr = `${stderr}${chunk}`.slice(-4000);
      });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(friendlyFfmpegError(stderr, code)));
      });
    });
  }

  private runFfmpeg(args: string[], durationSeconds: number, onRatio: (ratio: number) => void): Promise<void> {
    this.throwIfCancelled();
    return new Promise((resolve, reject) => {
      const child = spawn(this.binary('ffmpeg'), args, { windowsHide: true });
      this.activeProcess = child;
      let stderr = '';
      let stdoutBuffer = '';
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
        stdoutBuffer += chunk;
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() ?? '';
        for (const line of lines) {
          const [key, value] = line.split('=');
          // Both keys hold microseconds; out_time_ms is the older name.
          if (key !== 'out_time_us' && key !== 'out_time_ms') continue;
          const seconds = Number(value) / 1_000_000;
          if (Number.isFinite(seconds) && durationSeconds > 0) {
            onRatio(Math.min(0.995, Math.max(0, seconds / durationSeconds)));
          }
        }
      });
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
        stderr = `${stderr}${chunk}`.slice(-6000);
      });
      child.once('error', (error) => {
        this.activeProcess = null;
        reject(error);
      });
      child.once('close', (code) => {
        this.activeProcess = null;
        if (this.cancelled) reject(new CompressionCancelledError());
        else if (code !== 0) reject(new Error(friendlyFfmpegError(stderr, code)));
        else resolve();
      });
    });
  }

  private throwIfCancelled(): void {
    if (this.cancelled) throw new CompressionCancelledError();
  }
}

function friendlyFfmpegError(stderr: string, code: number | null): string {
  const lines = stderr.trim().split('\n').filter(Boolean);
  if (/No space left on device/i.test(stderr)) return 'The disk is full. Free up some space and try again.';
  if (/Invalid data found|moov atom not found|could not find codec/i.test(stderr)) {
    return 'This video file is damaged or uses a format Squik cannot read.';
  }
  return lines.slice(-3).join(' ') || `FFmpeg exited with code ${code}.`;
}

function encodeArgs(source: EncodeSource, blueprint: BitrateCalculation, outputPath: string): string[] {
  const videoBitrate = `${Math.round(blueprint.videoBitrateBps)}`;
  // Bound the long side, so portrait phone video shrinks like landscape does,
  // and never go above 1080p: at these bitrates 4K only looks worse.
  const maxSide = blueprint.isScalingNeeded ? blueprint.maxDimension : MAX_OUTPUT_DIMENSION;
  const scale =
    `scale=w=if(gte(iw\\,ih)\\,min(${maxSide}\\,iw)\\,-2):h=if(gte(iw\\,ih)\\,-2\\,min(${maxSide}\\,ih))` +
    ',scale=trunc(iw/2)*2:trunc(ih/2)*2';
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-nostats', '-progress', 'pipe:1'];
  for (const input of source.inputs) args.push('-i', input);
  const keepAudio = source.audio !== null && blueprint.audioBitrateBps > 0;
  // A filtergraph audio label left unmapped must still be consumed.
  const dropAudio = !keepAudio && source.audio?.startsWith('[') ? `;${source.audio}anullsink` : '';
  args.push('-filter_complex', `${source.filter};[srcv]${scale},format=yuv420p[outv]${dropAudio}`, '-map', '[outv]');
  if (keepAudio) {
    args.push('-map', source.audio!, '-c:a', 'aac', '-b:a', `${Math.round(blueprint.audioBitrateBps)}`);
  } else {
    args.push('-an');
  }
  args.push(
    // veryfast measured as fast as ultrafast once scaled down, at clearly better
    // quality per bit; native encodes are fast enough to afford it.
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-profile:v', 'high',
    '-threads', '0',
    '-b:v', videoBitrate,
    '-maxrate', videoBitrate,
    '-bufsize', `${Math.round(blueprint.videoBitrateBps * 2)}`,
    // Sparse or late audio otherwise aborts with "Too many packets buffered".
    '-max_muxing_queue_size', '4096',
    '-map_chapters', '-1',
    '-movflags', '+faststart',
    outputPath,
  );
  return args;
}

function compressSource(path: string, probe: ProbeResult): EncodeSource {
  return {
    inputs: [path],
    filter: `[0:${probe.videoStream}]null[srcv]`,
    audio: probe.audioStream === null ? null : `0:${probe.audioStream}`,
    durationSeconds: probe.duration,
    sourceBytes: probe.size,
  };
}

function trimSource(path: string, probe: ProbeResult, keeps: TrimSegment[]): EncodeSource {
  const hasAudio = probe.audioStream !== null;
  const parts: string[] = [];
  const concatInputs: string[] = [];
  keeps.forEach(({ startSec, endSec }, i) => {
    parts.push(`[0:${probe.videoStream}]trim=start=${startSec}:end=${endSec},setpts=PTS-STARTPTS,setsar=1[v${i}]`);
    concatInputs.push(`[v${i}]`);
    if (hasAudio) {
      parts.push(`[0:${probe.audioStream}]atrim=start=${startSec}:end=${endSec},asetpts=PTS-STARTPTS[a${i}]`);
      concatInputs.push(`[a${i}]`);
    }
  });
  parts.push(`${concatInputs.join('')}concat=n=${keeps.length}:v=1:a=${hasAudio ? 1 : 0}[srcv]${hasAudio ? '[srca]' : ''}`);
  const durationSeconds = keeps.reduce((sum, keep) => sum + keep.endSec - keep.startSec, 0);
  return {
    inputs: [path],
    filter: parts.join(';'),
    audio: hasAudio ? '[srca]' : null,
    durationSeconds,
    // Size the ladder by the part that is kept, not the whole source.
    sourceBytes: Math.round(probe.size * (durationSeconds / probe.duration)),
  };
}

function evenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function mergeSource(paths: string[], probes: ProbeResult[]): EncodeSource {
  const maxWidth = Math.max(...probes.map((probe) => probe.width));
  const maxHeight = Math.max(...probes.map((probe) => probe.height));
  const fit = Math.min(1, MERGE_MAX_DIMENSION / Math.max(maxWidth, maxHeight));
  const width = evenDimension(maxWidth * fit);
  const height = evenDimension(maxHeight * fit);
  const hasAnyAudio = probes.some((probe) => probe.audioStream !== null);

  const parts: string[] = [];
  const concatInputs: string[] = [];
  probes.forEach((probe, i) => {
    parts.push(
      `[${i}:${probe.videoStream}]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${MERGE_FPS},format=yuv420p[v${i}]`,
    );
    concatInputs.push(`[v${i}]`);
    if (!hasAnyAudio) return;
    parts.push(
      probe.audioStream !== null
        ? `[${i}:${probe.audioStream}]aformat=sample_rates=48000:channel_layouts=stereo,aresample=async=1:first_pts=0[a${i}]`
        : `anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${probe.duration},asetpts=PTS-STARTPTS[a${i}]`,
    );
    concatInputs.push(`[a${i}]`);
  });
  parts.push(
    `${concatInputs.join('')}concat=n=${paths.length}:v=1:a=${hasAnyAudio ? 1 : 0}[srcv]${hasAnyAudio ? '[srca]' : ''}`,
  );

  return {
    inputs: paths,
    filter: parts.join(';'),
    audio: hasAnyAudio ? '[srca]' : null,
    durationSeconds: probes.reduce((sum, probe) => sum + probe.duration, 0),
    sourceBytes: probes.reduce((sum, probe) => sum + probe.size, 0),
  };
}
