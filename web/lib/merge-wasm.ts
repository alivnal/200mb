/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { fetchFile } from '@ffmpeg/util';
import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { CompressionCancelledError, type VideoProbeMetadata } from '@squish/core';
import { extFromName, loadFFmpeg, probeVideoFile } from './compress-wasm';
import { WEB_MERGE_MAX_DIMENSION } from './web-compress-strategy';

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
    // Header probe only — avoid decoding the entire file.
    await ffmpeg.exec(['-hide_banner', '-i', inputName]);
  } catch {
    // ffmpeg -i exits non-zero when no output is specified.
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
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-tune',
    'zerolatency',
    '-profile:v',
    'baseline',
    '-x264-params',
    'ref=1:me=dia:subme=0:8x8dct=0:weightp=0',
    '-threads',
    '1',
    '-crf',
    '28',
    '-movflags',
    '+faststart',
    outputName,
  );

  return args;
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
    throw new Error('Select at least two videos to merge.');
  }

  const { onProgress, onLoadProgress, isCancelled } = options ?? {};
  onLoadProgress?.(0);
  const ffmpeg = await loadFFmpeg(onLoadProgress);
  if (isCancelled?.()) throw new CompressionCancelledError();

  const probes: VideoProbeMetadata[] = [];
  let totalInputSize = 0;
  for (const file of files) {
    probes.push(await probeVideoFile(file));
    totalInputSize += file.size;
    if (isCancelled?.()) throw new CompressionCancelledError();
  }

  const inputNames: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const inputName = `merge_input_${i}${extFromName(files[i].name)}`;
    inputNames.push(inputName);
    await ffmpeg.writeFile(inputName, await fetchFile(files[i]));
    if (isCancelled?.()) throw new CompressionCancelledError();
  }

  const hasAudio: boolean[] = [];
  for (const inputName of inputNames) {
    hasAudio.push(await probeHasAudio(ffmpeg, inputName));
    if (isCancelled?.()) throw new CompressionCancelledError();
  }

  const totalDurationSeconds = probes.reduce((sum, p) => sum + p.duration, 0);
  const outputName = 'merged.mp4';
  const args = buildFilterMergeArgs(inputNames, probes, hasAudio, outputName);

  const progressHandler = ({ progress }: { progress: number }) => {
    if (isCancelled?.()) return;
    const ratio = totalDurationSeconds > 0 ? Math.min(0.99, progress) : progress;
    onProgress?.(ratio);
  };

  ffmpeg.on('progress', progressHandler);
  try {
    const code = await ffmpeg.exec(args);
    if (isCancelled?.()) throw new CompressionCancelledError();
    if (code !== 0) {
      throw new Error('FFmpeg merge failed. Clips may be too large for your browser.');
    }
  } finally {
    ffmpeg.off('progress', progressHandler);
  }

  const data = await ffmpeg.readFile(outputName);
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
  const blob = new Blob([bytes], { type: 'video/mp4' });

  const mergedMeta = await probeVideoFile(
    new File([blob], 'merged.mp4', { type: 'video/mp4' }),
  );

  for (const inputName of inputNames) {
    await ffmpeg.deleteFile(inputName).catch(() => {});
  }
  await ffmpeg.deleteFile(outputName).catch(() => {});

  onProgress?.(1);
  return { blob, metadata: mergedMeta, totalInputSize };
}
