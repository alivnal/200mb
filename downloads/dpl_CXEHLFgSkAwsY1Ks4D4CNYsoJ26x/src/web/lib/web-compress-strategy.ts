/**
 * Web compression — target ~190 MB (cap 200 MB), balanced speed vs quality.
 */

import {
  MAX_OUTPUT_BYTES,
  TARGET_SIZE_MB,
  adjustBitrateForOvershoot,
  calculateTargetBitrates,
  mapAttemptProgress,
  type BitrateCalculation,
  type EncodePass,
} from '@squish/core';

/** Web tiers: capped resolution for WASM speed; audio always kept. */
export const WEB_DEGRADATION_PASSES: EncodePass[] = [
  { bitrateMultiplier: 1, maxDimensionOverride: 1280, removeAudio: false },
  { bitrateMultiplier: 0.75, maxDimensionOverride: 854, removeAudio: false },
  { bitrateMultiplier: 0.55, maxDimensionOverride: 640, removeAudio: false },
  { bitrateMultiplier: 0.45, maxDimensionOverride: 640, removeAudio: false },
];

/** One retry per tier on web — extra passes are costly in WASM. */
export const WEB_MAX_BITRATE_RETRIES = 1;

function estimateOutputBytes(blueprint: BitrateCalculation, durationSeconds: number): number {
  const safeDuration = Math.max(durationSeconds, 1);
  return ((blueprint.videoBitrateBps + blueprint.audioBitrateBps) * safeDuration) / 8;
}

export function blueprintForWebPass(passIndex: number, durationSeconds: number): BitrateCalculation {
  const pass = WEB_DEGRADATION_PASSES[passIndex] ?? WEB_DEGRADATION_PASSES.at(-1)!;
  return calculateTargetBitrates(
    durationSeconds,
    pass.removeAudio,
    pass.bitrateMultiplier,
    pass.maxDimensionOverride,
  );
}

/**
 * Pick the best tier that should hit under 200 MB in one pass, with a speed
 * bias for large sources so WASM does not waste time on a full-res first encode.
 */
export function estimateWebStartPassIndex(durationSeconds: number, sourceSizeBytes: number): number {
  let tier = WEB_DEGRADATION_PASSES.length - 1;
  for (let t = 0; t < WEB_DEGRADATION_PASSES.length; t++) {
    const blueprint = blueprintForWebPass(t, durationSeconds);
    if (estimateOutputBytes(blueprint, durationSeconds) <= MAX_OUTPUT_BYTES) {
      tier = t;
      break;
    }
  }

  // Speed bias — large files skip the slowest full-res pass in the browser.
  if (sourceSizeBytes > 500 * 1024 * 1024 && tier < 1) tier = 1;
  if (sourceSizeBytes > 850 * 1024 * 1024 && tier < 2) tier = 2;

  // Last tier is fallback only (after failed encodes).
  return Math.min(tier, 2);
}

export function maxWebCompressionAttempts(startTierIndex: number): number {
  const tiersLeft = WEB_DEGRADATION_PASSES.length - startTierIndex;
  return tiersLeft * (WEB_MAX_BITRATE_RETRIES + 1);
}

export function mapWebAttemptProgress(
  attemptIndex: number,
  encodeRatio: number,
  maxAttempts: number,
): number {
  return mapAttemptProgress(attemptIndex, encodeRatio, maxAttempts);
}

export { adjustBitrateForOvershoot, MAX_OUTPUT_BYTES, TARGET_SIZE_MB };

export function buildWasmLibx264FfmpegArgs(
  inputName: string,
  outputName: string,
  blueprint: BitrateCalculation,
  hasAudio: boolean,
): string[] {
  const videoBitrate = `${Math.round(blueprint.videoBitrateBps)}`;
  const maxrate = videoBitrate;
  const bufsize = `${Math.round(blueprint.videoBitrateBps * 2)}`;
  const scale = blueprint.isScalingNeeded
    ? `scale=min(${blueprint.maxDimension}\\,iw):-2:flags=fast_bilinear`
    : 'scale=trunc(iw/2)*2:-2';

  const args = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    inputName,
    '-vf',
    scale,
    '-map',
    '0:v:0',
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
    '-b:v',
    videoBitrate,
    '-maxrate',
    maxrate,
    '-bufsize',
    bufsize,
  ];

  if (hasAudio && blueprint.audioBitrateBps > 0) {
    args.push('-map', '0:a:0?', '-c:a', 'aac', '-b:a', `${Math.round(blueprint.audioBitrateBps)}`);
  }

  args.push('-movflags', '+faststart', outputName);
  return args;
}

export const WEB_MERGE_MAX_DIMENSION = 1280;
