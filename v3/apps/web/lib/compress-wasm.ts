/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {
  MAX_OUTPUT_BYTES,
  CompressionCancelledError,
  type BitrateCalculation,
  type VideoProbeMetadata,
  type WebCompressionResult,
} from '@/lib/squish-core';
import {
  WEB_DEGRADATION_PASSES,
  WEB_MAX_BITRATE_RETRIES,
  adjustBitrateForOvershoot,
  blueprintForWebPass,
  buildWasmLibx264FfmpegArgs,
  estimateWebStartPassIndex,
  maxWebCompressionAttempts,
} from './web-compress-strategy';
import { getI18nInstance, translatePhase } from '@squish/i18n';
import {
  CompressJobProgress,
  estimateUploadMs,
  formatElapsed,
  parseFfmpegLogTime,
  type CompressionProgressSnapshot,
} from './compress-progress';

function t(key: string): string {
  return getI18nInstance().t(key);
}
import { ENCODER_LABEL } from './platform';

const FFMPEG_CORE_VERSION = '0.12.6';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
let activeSession = 0;

export type { CompressionProgressSnapshot };

export function extFromName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot) : '.mp4';
}

function basenameNoExt(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(0, dot) : base;
}

function scaleProgress(
  snap: CompressionProgressSnapshot,
  offset: number,
  span: number,
): CompressionProgressSnapshot {
  return {
    ...snap,
    progress: offset + snap.progress * span,
  };
}

export async function probeVideoFile(file: File): Promise<VideoProbeMetadata> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const meta = await new Promise<{ duration: number; width: number; height: number }>(
      (resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          resolve({
            duration: Number.isFinite(video.duration) ? video.duration : 0,
            width: video.videoWidth || 1920,
            height: video.videoHeight || 1080,
          });
        };
        video.onerror = () =>
          reject(new Error(t('errors.metadataReadFailed')));
        video.src = objectUrl;
      },
    );
    return {
      name: file.name,
      size: file.size,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function loadFFmpeg(onLoadProgress?: (ratio: number) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', () => {});

    const baseURL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    onLoadProgress?.(1);
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

export function cancelWasmCompression(): void {
  activeSession += 1;
  if (ffmpegInstance) {
    ffmpegInstance.terminate();
    ffmpegInstance = null;
    loadPromise = null;
  }
}

function isCancelled(session: number): boolean {
  return session !== activeSession;
}

async function probeHasAudio(ffmpeg: FFmpeg, inputName: string): Promise<boolean> {
  let log = '';
  const handler = ({ message }: { message: string }) => {
    log += `${message}\n`;
  };
  ffmpeg.on('log', handler);
  try {
    await ffmpeg.exec(['-hide_banner', '-i', inputName]);
  } catch {
    // ffmpeg -i exits non-zero when no output is specified.
  } finally {
    ffmpeg.off('log', handler);
  }
  return /Audio:/i.test(log);
}

async function runWasmEncode(
  ffmpeg: FFmpeg,
  inputName: string,
  outputName: string,
  blueprint: BitrateCalculation,
  hasAudio: boolean,
  durationSeconds: number,
  session: number,
  attemptIndex: number,
  jobProgress: CompressJobProgress,
): Promise<number> {
  if (isCancelled(session)) throw new CompressionCancelledError();

  const args = buildWasmLibx264FfmpegArgs(inputName, outputName, blueprint, hasAudio);
  const encodeStarted = Date.now();
  let bestRatio = 0;

  const reportEncode = (ratio: number) => {
    bestRatio = Math.max(bestRatio, Math.min(0.995, ratio));
    jobProgress.setEncodeAttempt(attemptIndex, bestRatio);
  };

  const progressHandler = ({ progress }: { progress: number }) => {
    if (isCancelled(session)) return;
    if (durationSeconds > 0) {
      reportEncode(progress);
    }
  };

  const logHandler = ({ message }: { message: string }) => {
    if (isCancelled(session) || durationSeconds <= 0) return;
    const seconds = parseFfmpegLogTime(message);
    if (seconds !== null) {
      reportEncode(seconds / durationSeconds);
    }
  };

  jobProgress.setEncodeAttempt(attemptIndex, 0);
  ffmpeg.on('progress', progressHandler);
  ffmpeg.on('log', logHandler);

  try {
    const code = await ffmpeg.exec(args);
    if (isCancelled(session)) throw new CompressionCancelledError();
    if (code !== 0) {
      throw new Error(t('errors.encodingFailed'));
    }
    reportEncode(1);
    return Date.now() - encodeStarted;
  } finally {
    ffmpeg.off('progress', progressHandler);
    ffmpeg.off('log', logHandler);
  }
}

async function compressFileWithFfmpeg(
  file: File,
  metadata: VideoProbeMetadata,
  session: number,
  jobProgress: CompressJobProgress,
  options?: {
    onLoadProgress?: (progress: number) => void;
    originalSize?: number;
    outputFilename?: string;
    clipCount?: number;
  },
): Promise<WebCompressionResult> {
  const { onLoadProgress, originalSize, outputFilename, clipCount } = options ?? {};

  const basename = basenameNoExt(file.name);
  const filename = outputFilename ?? `${basename}_compressed.mp4`;
  const sourceSize = originalSize ?? metadata.size;

  if (metadata.size <= MAX_OUTPUT_BYTES) {
    jobProgress.finish();
    const outputUrl = URL.createObjectURL(file);
    return {
      compressedSize: metadata.size,
      originalSize: sourceSize,
      outputPath: filename,
      skippedEncode: true,
      filename,
      encoderLabel: ENCODER_LABEL,
      outputBlob: file,
      outputUrl,
      clipCount,
      encodeTimeMs: 0,
      totalTimeMs: jobProgress.getTotalElapsedMs(),
    };
  }

  jobProgress.enterPhase('loading', 0);
  const ffmpeg = await loadFFmpeg((ratio) => {
    jobProgress.update(ratio);
    if (ratio >= 1) onLoadProgress?.(1);
  });
  if (isCancelled(session)) throw new CompressionCancelledError();
  jobProgress.enterPhase('loading', 1);

  const inputName = `input${extFromName(file.name)}`;
  const outputName = 'output.mp4';

  try {
    jobProgress.enterPhase('uploading', 0);
    const uploadStarted = Date.now();
    const uploadBudget = estimateUploadMs(file.size);
    const uploadTimer = window.setInterval(() => {
      if (isCancelled(session)) return;
      const ratio = Math.min(0.92, (Date.now() - uploadStarted) / uploadBudget);
      jobProgress.update(ratio);
    }, 250);

    await ffmpeg.writeFile(inputName, await fetchFile(file));
    window.clearInterval(uploadTimer);
    if (isCancelled(session)) throw new CompressionCancelledError();
    jobProgress.enterPhase('uploading', 1);

    const hasAudio = await probeHasAudio(ffmpeg, inputName);
    if (isCancelled(session)) throw new CompressionCancelledError();

    const startTierIndex = estimateWebStartPassIndex(metadata.duration, sourceSize);
    let tierIndex = startTierIndex;
    let bitrateRetriesLeft = WEB_MAX_BITRATE_RETRIES;
    let blueprint = blueprintForWebPass(tierIndex, metadata.duration);
    let attemptIndex = 0;
    let totalEncodeMs = 0;
    jobProgress.setEncodeAttempts(maxWebCompressionAttempts(startTierIndex));

    while (tierIndex < WEB_DEGRADATION_PASSES.length) {
      if (isCancelled(session)) throw new CompressionCancelledError();

      try {
        await ffmpeg.deleteFile(outputName);
      } catch {
        // output may not exist yet
      }

      const encodeMs = await runWasmEncode(
        ffmpeg,
        inputName,
        outputName,
        blueprint,
        hasAudio,
        metadata.duration,
        session,
        attemptIndex,
        jobProgress,
      );
      totalEncodeMs += encodeMs;
      attemptIndex++;

      jobProgress.enterPhase('finalizing', 0.3);
      const data = await ffmpeg.readFile(outputName);
      const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
      const blob = new Blob([bytes], { type: 'video/mp4' });

      if (blob.size < MAX_OUTPUT_BYTES) {
        jobProgress.finish();
        const totalTimeMs = jobProgress.getTotalElapsedMs();
        console.info(
          `[Squish] Compression complete — encode ${formatElapsed(totalEncodeMs)}, total ${formatElapsed(totalTimeMs)}`,
        );
        const outputUrl = URL.createObjectURL(blob);
        return {
          compressedSize: blob.size,
          originalSize: sourceSize,
          outputPath: filename,
          skippedEncode: false,
          filename,
          encoderLabel: ENCODER_LABEL,
          outputBlob: blob,
          outputUrl,
          clipCount,
          encodeTimeMs: totalEncodeMs,
          totalTimeMs,
        };
      }

      if (bitrateRetriesLeft > 0) {
        blueprint = adjustBitrateForOvershoot(blueprint, blob.size);
        bitrateRetriesLeft--;
        continue;
      }

      bitrateRetriesLeft = WEB_MAX_BITRATE_RETRIES;
      tierIndex++;
      if (tierIndex >= WEB_DEGRADATION_PASSES.length) break;
      blueprint = blueprintForWebPass(tierIndex, metadata.duration);
    }

    throw new Error(
      'Video too long or large to compress under 200 MB. Try a shorter clip or lower resolution source.',
    );
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}

export async function compressVideoWasm(
  file: File,
  options?: {
    onProgress?: (snapshot: CompressionProgressSnapshot) => void;
    onLoadProgress?: (progress: number) => void;
  },
): Promise<WebCompressionResult> {
  const session = activeSession;
  const { onProgress, onLoadProgress } = options ?? {};

  const jobProgress = new CompressJobProgress(onProgress);
  jobProgress.enterPhase('preparing', 0);

  const metadata = await probeVideoFile(file);
  if (isCancelled(session)) throw new CompressionCancelledError();
  jobProgress.enterPhase('preparing', 1);

  return compressFileWithFfmpeg(file, metadata, session, jobProgress, { onLoadProgress });
}

export async function mergeAndCompressVideosWasm(
  files: File[],
  options?: {
    onProgress?: (snapshot: CompressionProgressSnapshot) => void;
    onLoadProgress?: (progress: number) => void;
  },
): Promise<WebCompressionResult> {
  const session = activeSession;
  const { onProgress, onLoadProgress } = options ?? {};

  if (files.length < 2) {
    throw new Error(t('errors.mergeMinTwo'));
  }

  const { mergeVideosWasm } = await import('./merge-wasm');

  const mergeStarted = Date.now();
  onProgress?.({
    progress: 0.02,
    phase: 'preparing',
    phaseLabel: translatePhase('preparingMerge'),
    elapsedMs: 0,
    encodeElapsedMs: null,
  });

  const { blob, metadata, totalInputSize } = await mergeVideosWasm(files, {
    onLoadProgress,
    isCancelled: () => isCancelled(session),
    onProgress: (ratio) => {
      onProgress?.({
        progress: 0.04 + ratio * 0.31,
        phase: 'uploading',
        phaseLabel: translatePhase('mergingClips'),
        elapsedMs: Date.now() - mergeStarted,
        encodeElapsedMs: null,
      });
    },
  });

  if (isCancelled(session)) throw new CompressionCancelledError();

  const firstBasename = basenameNoExt(files[0].name);
  const mergedFile = new File([blob], `${firstBasename}_merged.mp4`, { type: 'video/mp4' });

  const compressReporter = new CompressJobProgress((snap) => {
    onProgress?.(scaleProgress(snap, 0.35, 0.65));
  });

  const result = await compressFileWithFfmpeg(mergedFile, metadata, session, compressReporter, {
    originalSize: totalInputSize,
    outputFilename: `${firstBasename}_merged_compressed.mp4`,
    clipCount: files.length,
  });

  console.info(`[Squish] Merge+compress — merge ${formatElapsed(Date.now() - mergeStarted)}`);
  return result;
}
