import { MAX_OUTPUT_BYTES, TARGET_SIZE_MB } from './constants';
import type { BitrateCalculation } from './types';
import {
  DEGRADATION_PASSES,
  calculateTargetBitrates,
  stepDownDimension,
} from './bitrate';

/** Retries at the same degradation tier before stepping down. */
export const MAX_BITRATE_RETRIES = 2;

/** Shrink factor applied when an encode overshoots the 200 MB cap. */
export const BITRATE_SAFETY_FACTOR = 0.9;

const MIN_VIDEO_BITRATE_BPS = 120_000;
const MIN_AUDIO_BITRATE_BPS = 48_000;

/**
 * Skip easy tiers when the source is far above the target size — avoids wasted full-quality encodes.
 */
export function estimateStartPassIndex(durationSeconds: number, sourceSizeBytes: number): number {
  const safeDuration = Math.max(durationSeconds, 1);
  const sourceRate = sourceSizeBytes / safeDuration;
  const targetRate = (TARGET_SIZE_MB * 1024 * 1024) / safeDuration;
  const compressionNeeded = sourceRate / Math.max(targetRate, 1);

  if (compressionNeeded <= 1.25) return 0;
  if (compressionNeeded <= 2.5) return 1;
  if (compressionNeeded <= 5) return 2;
  return 3;
}

export function blueprintForDegradationPass(
  passIndex: number,
  durationSeconds: number,
): BitrateCalculation {
  const pass = DEGRADATION_PASSES[passIndex] ?? DEGRADATION_PASSES[DEGRADATION_PASSES.length - 1];
  let maxDim = pass.maxDimensionOverride;

  if (passIndex === 1 && !maxDim) {
    const base = calculateTargetBitrates(durationSeconds, false);
    maxDim = stepDownDimension(base.maxDimension);
  }

  return calculateTargetBitrates(
    durationSeconds,
    pass.removeAudio,
    pass.bitrateMultiplier,
    maxDim,
  );
}

export function adjustBitrateForOvershoot(
  blueprint: BitrateCalculation,
  outputBytes: number,
): BitrateCalculation {
  const factor = (MAX_OUTPUT_BYTES / outputBytes) * BITRATE_SAFETY_FACTOR;
  return {
    ...blueprint,
    videoBitrateBps: Math.max(
      MIN_VIDEO_BITRATE_BPS,
      Math.round(blueprint.videoBitrateBps * factor),
    ),
    audioBitrateBps:
      blueprint.audioBitrateBps > 0
        ? Math.max(MIN_AUDIO_BITRATE_BPS, Math.round(blueprint.audioBitrateBps * factor))
        : 0,
  };
}

export function maxCompressionAttempts(): number {
  return DEGRADATION_PASSES.length * (MAX_BITRATE_RETRIES + 1);
}

export function mapAttemptProgress(
  attemptIndex: number,
  encodeRatio: number,
  maxAttempts = maxCompressionAttempts(),
): number {
  const span = 1 / maxAttempts;
  const start = attemptIndex / maxAttempts;
  return Math.min(0.99, start + encodeRatio * span);
}
