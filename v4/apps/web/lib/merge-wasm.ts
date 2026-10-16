/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getI18nInstance } from '@squish/i18n';
import { fetchFile } from '@ffmpeg/util';
import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { CompressionCancelledError, type VideoProbeMetadata } from '@/lib/squish-core';
import { extFromName, loadFFmpeg, probeVideoFile } from './compress-wasm';
import { WEB_MERGE_MAX_DIMENSION } from './web-compress-strategy';

function t(key: string): string {
  return getI18nInstance().t(key);
}

function evenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function capMergeDimensions(width: number, height: number): { width: number; height: number } {
  const maxSide = Math.max(width, height);
  if (maxSide <= WEB_MERGE_MAX_DIMENSION) {
    return { width: evenDimension(width), height: evenDimension(height) };
  }
  const scale = WEB_MERGE_MAX_DIMENSION / maxSide;
  return {
    width: evenDimension(width * scale),
    height: evenDimension(height * scale),
  };
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
    // ffmpeg -i exits non-zero when no output is specified — that's expected.
  } finally {
    ffmpeg.off('log', handler);
  }
  return /Audio:/i.test(log);
}

function buildFilterMergeArgs(
  inputNames: string[],
  probes: VideoProbeMetadata[],
  hasAudio: boolean[],
  outputName: string,
): string[] {
  const maxW = evenDimension(Math.max(...probes.map((p) => p.width)));
  const maxH = evenDimension(Math.max(...probes.map((p) => p.height)));
  const capped = capMergeDimensions(maxW, maxH);
  const allHaveAudio = hasAudio.every(Boolean);

  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-nostats'];
  for (const inputName of inputNames) {
    args.push('-i', inputName);
  }

  const filterParts: string[] = [];
  const concatInputs: string[] = [];

  for (let i = 0; i < inputNames.length; i++) {
    filterParts.push(
      `[${i}:v]scale=${capped.width}:${capped.height}:force_original_aspect_ratio=decrease:flags=fast_bilinear,pad=${capped.width}:${capped.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p[v${i}]`,
    );
    concatInputs.push(`[v${i}]`);

    if (allHaveAudio) {
      filterParts.push(
        `[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,aresample=async=1:first_pts=0[a${i}]`,
      );
      concatInputs.push(`[a${i}]`);
    }
  }

  if (allHaveAudio) {
    filterParts.push(
      `${concatInputs.join('')}concat=n=${inputNames.length}:v=1:a=1[outv][outa]`,
    );
  } else {
    filterParts.push(`${concatInputs.join('')}concat=n=${inputNames.length}:v=1:a=0[outv]`);
  }

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '[outv]');
  if (allHaveAudio) {
    args.push('-map', '[outa]', '-c:a', 'aac', '-b:a', '96k');
  } else {
    args.push('-an');
  }
  args.push(
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-profile:v', 'baseline',
    '-x264-params', 'ref=1:me=dia:subme=0:8x8dct=0:weightp=0',
    '-threads', '1',
    '-crf', '28',
    '-movflags', '+faststart',
    outputName,
  );

  return args;
}

/** Estimate upload time to WASM FS from byte count. */
function estimateUploadMs(bytes: number): number {
  return Math.max(3000, (bytes / (80 * 1024 * 1024)) * 1000);
}

export async function mergeVideosWasm(
  files: File[],
  options?: {
    onProgress?: (progress: number) => void;
    onLoadProgress?: (progress: number) => void;
    isCancelled?: () => boolean;
  },
): Promise<{ blob: Blob; metadata: VideoProbeMetadata; totalInputSize: number }> {
  if (files.length < 2) {
    throw new Error(t('errors.mergeMinTwo'));
  }

  const { onProgress, onLoadProgress, isCancelled } = options ?? {};
  const totalInputSize = files.reduce((s, f) => s + f.size, 0);

  // ── Phase 1: load FFmpeg + probe all files in parallel ──────────────
  onLoadProgress?.(0);
  const [ffmpeg, ...probes] = await Promise.all([
    loadFFmpeg(onLoadProgress),
    ...files.map((f) => probeVideoFile(f)),
  ]);
  if (isCancelled?.()) throw new CompressionCancelledError();

  const inputNames = files.map((f, i) => `merge_input_${i}${extFromName(f.name)}`);
  const outputName = 'merged.mp4';

  try {
    // ── Phase 2: upload files to WASM FS with per-file progress ─────────
    const totalBytes = totalInputSize;
    let uploadedBytes = 0;

    for (let i = 0; i < files.length; i++) {
      if (isCancelled?.()) throw new CompressionCancelledError();

      const file = files[i];
      const uploadStart = Date.now();
      const budget = estimateUploadMs(file.size);

      // Tick progress during fetch+write
      const ticker = window.setInterval(() => {
        if (isCancelled?.()) return;
        const ratio = Math.min(0.95, (Date.now() - uploadStart) / budget);
        const fileFraction = file.size / totalBytes;
        onProgress?.((uploadedBytes / totalBytes) + ratio * fileFraction);
      }, 200);

      try {
        await ffmpeg.writeFile(inputNames[i], await fetchFile(file));
      } finally {
        window.clearInterval(ticker);
      }

      uploadedBytes += file.size;
      onProgress?.(uploadedBytes / totalBytes);
      if (isCancelled?.()) throw new CompressionCancelledError();
    }

    // ── Phase 3: probe audio for each input ──────────────────────────────
    const hasAudio: boolean[] = await Promise.all(
      inputNames.map((name) => probeHasAudio(ffmpeg, name)),
    );
    if (isCancelled?.()) throw new CompressionCancelledError();

    // ── Phase 4: merge encode ────────────────────────────────────────────
    const totalDurationSeconds = probes.reduce((s, p) => s + p.duration, 0);
    const args = buildFilterMergeArgs(inputNames, probes, hasAudio, outputName);

    const progressHandler = ({ progress }: { progress: number }) => {
      if (isCancelled?.()) return;
      const ratio = totalDurationSeconds > 0 ? Math.min(0.99, progress) : progress;
      onProgress?.(ratio);
    };

    ffmpeg.on('progress', progressHandler);
    let code: number;
    try {
      code = await ffmpeg.exec(args);
    } finally {
      ffmpeg.off('progress', progressHandler);
    }

    if (isCancelled?.()) throw new CompressionCancelledError();
    if (code !== 0) throw new Error(t('errors.mergeFailed'));

    // ── Phase 5: read output + build metadata from probed dims ───────────
    const data = await ffmpeg.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
    const blob = new Blob([bytes], { type: 'video/mp4' });

    // Derive merged metadata: use probed dims/duration, avoid a second FFmpeg probe.
    const maxW = Math.max(...probes.map((p) => p.width));
    const maxH = Math.max(...probes.map((p) => p.height));
    const capped = capMergeDimensions(maxW, maxH);
    const mergedMeta: VideoProbeMetadata = {
      name: 'merged.mp4',
      size: blob.size,
      duration: totalDurationSeconds,
      width: capped.width,
      height: capped.height,
    };

    onProgress?.(1);
    return { blob, metadata: mergedMeta, totalInputSize };
  } finally {
    // Always clean up WASM FS — even on error or cancellation.
    await Promise.all([
      ...inputNames.map((name) => ffmpeg.deleteFile(name).catch(() => {})),
      ffmpeg.deleteFile(outputName).catch(() => {}),
    ]);
  }
}
