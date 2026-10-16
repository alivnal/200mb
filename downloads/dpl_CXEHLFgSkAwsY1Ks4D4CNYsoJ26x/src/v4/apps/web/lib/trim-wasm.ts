/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { getI18nInstance } from '@squish/i18n';
import {
  CompressionCancelledError,
  deleteSegmentsToKeepSegments,
  mergeTrimSegments,
  type TrimSegment,
  validateDeleteSegments,
  type VideoProbeMetadata,
} from '@/lib/squish-core';
import { parseFfmpegLogTime } from './compress-progress';
import type { BitrateCalculation } from '@/lib/squish-core';
import {
  blueprintForWebPass,
  buildWasmTrimAndCompressFilterFfmpegArgs,
  buildWasmTrimFilterFfmpegArgs,
  estimateWebStartPassIndex,
} from './web-compress-strategy';

function t(key: string): string {
  return getI18nInstance().t(key);
}

export const TRIM_OUTPUT_NAME = 'trimmed.mp4';

export interface TrimWasmFsResult {
  outputName: string;
  metadata: VideoProbeMetadata;
  deleteSegmentCount: number;
  hasAudio: boolean;
  totalKeepDuration: number;
}

function durationSlop(expectedSec: number): number {
  return Math.max(3, expectedSec * 0.02);
}

export function resolveTrimSegments(
  deleteSegments: TrimSegment[],
  sourceDurationSec: number,
): {
  mergedDeletes: TrimSegment[];
  keepSegments: TrimSegment[];
  totalKeepDuration: number;
} {
  const mergedDeletes = mergeTrimSegments(deleteSegments);
  if (mergedDeletes.length === 0) {
    throw new Error(t('errors.trimRangeEmpty'));
  }

  const validationError = validateDeleteSegments(mergedDeletes, sourceDurationSec);
  if (validationError) {
    if (validationError === 'outOfBounds') {
      throw new Error(t('errors.trimRangeOutOfBounds'));
    }
    if (validationError === 'nothingLeft') {
      throw new Error(t('errors.trimRangeNothingLeft'));
    }
    throw new Error(t('errors.trimRangeInvalid'));
  }

  const keepSegments = deleteSegmentsToKeepSegments(mergedDeletes, sourceDurationSec);
  if (keepSegments.length === 0) {
    throw new Error(t('errors.trimRangeNothingLeft'));
  }

  const totalKeepDuration = keepSegments.reduce(
    (sum, segment) => sum + (segment.endSec - segment.startSec),
    0,
  );

  return { mergedDeletes, keepSegments, totalKeepDuration };
}

async function runTrimFilterExec(
  ffmpeg: FFmpeg,
  args: string[],
  totalKeepDuration: number,
  options?: {
    onProgress?: (progress: number) => void;
    isCancelled?: () => boolean;
    verifyDuration?: boolean;
  },
): Promise<void> {
  const { onProgress, isCancelled, verifyDuration = true } = options ?? {};
  let lastEncodedSec = 0;

  const progressHandler = ({ progress }: { progress: number }) => {
    if (isCancelled?.()) return;
    if (totalKeepDuration > 0) {
      onProgress?.(Math.min(0.99, progress));
      lastEncodedSec = Math.max(lastEncodedSec, progress * totalKeepDuration);
    }
  };

  const logHandler = ({ message }: { message: string }) => {
    if (isCancelled?.() || totalKeepDuration <= 0) return;
    const seconds = parseFfmpegLogTime(message);
    if (seconds !== null) {
      lastEncodedSec = Math.max(lastEncodedSec, seconds);
      onProgress?.(Math.min(0.99, seconds / totalKeepDuration));
    }
  };

  ffmpeg.on('progress', progressHandler);
  ffmpeg.on('log', logHandler);

  let code: number;
  try {
    code = await ffmpeg.exec(args);
  } finally {
    ffmpeg.off('progress', progressHandler);
    ffmpeg.off('log', logHandler);
  }

  if (isCancelled?.()) throw new CompressionCancelledError();
  if (code !== 0) {
    throw new Error(t('errors.encodingFailed'));
  }

  if (
    verifyDuration &&
    Math.abs(lastEncodedSec - totalKeepDuration) > durationSlop(totalKeepDuration)
  ) {
    throw new Error(t('errors.trimRangeInvalid'));
  }

  onProgress?.(1);
}

/** Frame-accurate single-pass trim inside an existing FFmpeg.wasm session. */
export async function trimVideoInFfmpeg(
  ffmpeg: FFmpeg,
  inputName: string,
  sourceMeta: VideoProbeMetadata,
  deleteSegments: TrimSegment[],
  options?: {
    outputName?: string;
    blueprint?: BitrateCalculation;
    onProgress?: (progress: number) => void;
    isCancelled?: () => boolean;
  },
): Promise<TrimWasmFsResult> {
  const { outputName = TRIM_OUTPUT_NAME, blueprint, onProgress, isCancelled } = options ?? {};

  const { mergedDeletes, keepSegments, totalKeepDuration } = resolveTrimSegments(
    deleteSegments,
    sourceMeta.duration,
  );

  const hasAudio = await probeHasAudioInFfmpeg(ffmpeg, inputName);
  if (isCancelled?.()) throw new CompressionCancelledError();

  const tierIndex = estimateWebStartPassIndex(totalKeepDuration, sourceMeta.size);
  const encodeBlueprint = blueprint ?? blueprintForWebPass(tierIndex, totalKeepDuration);
  const args = buildWasmTrimFilterFfmpegArgs(
    inputName,
    keepSegments,
    outputName,
    encodeBlueprint,
    hasAudio,
  );

  await runTrimFilterExec(ffmpeg, args, totalKeepDuration, { onProgress, isCancelled });

  const data = await ffmpeg.readFile(outputName);
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);

  return {
    outputName,
    metadata: {
      name: sourceMeta.name,
      size: bytes.byteLength,
      duration: totalKeepDuration,
      width: sourceMeta.width,
      height: sourceMeta.height,
    },
    deleteSegmentCount: mergedDeletes.length,
    hasAudio,
    totalKeepDuration,
  };
}

/** Single FFmpeg exec: trim filter + compress-tier encode (no intermediate file). */
export async function trimAndCompressInFfmpeg(
  ffmpeg: FFmpeg,
  inputName: string,
  sourceMeta: VideoProbeMetadata,
  deleteSegments: TrimSegment[],
  outputName: string,
  blueprint: BitrateCalculation,
  options?: {
    onProgress?: (progress: number) => void;
    isCancelled?: () => boolean;
  },
): Promise<TrimWasmFsResult> {
  const { onProgress, isCancelled } = options ?? {};

  const { mergedDeletes, keepSegments, totalKeepDuration } = resolveTrimSegments(
    deleteSegments,
    sourceMeta.duration,
  );

  const hasAudio = await probeHasAudioInFfmpeg(ffmpeg, inputName);
  if (isCancelled?.()) throw new CompressionCancelledError();

  const args = buildWasmTrimAndCompressFilterFfmpegArgs(
    inputName,
    keepSegments,
    outputName,
    blueprint,
    hasAudio,
  );

  await runTrimFilterExec(ffmpeg, args, totalKeepDuration, { onProgress, isCancelled });

  const data = await ffmpeg.readFile(outputName);
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);

  return {
    outputName,
    metadata: {
      name: sourceMeta.name,
      size: bytes.byteLength,
      duration: totalKeepDuration,
      width: sourceMeta.width,
      height: sourceMeta.height,
    },
    deleteSegmentCount: mergedDeletes.length,
    hasAudio,
    totalKeepDuration,
  };
}

export async function probeHasAudioInFfmpeg(
  ffmpeg: FFmpeg,
  inputName: string,
): Promise<boolean> {
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
