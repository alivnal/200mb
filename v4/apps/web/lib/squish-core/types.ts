export enum AppStatus {
  IDLE = 'IDLE',
  COMPRESSING = 'COMPRESSING',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

export interface VideoProbeMetadata {
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
}

export interface VideoMetadata {
  name: string;
  path?: string;
  size?: number;
}

export interface TrimSegment {
  startSec: number;
  endSec: number;
}

export interface CompressionResult {
  compressedSize: number;
  originalSize: number;
  outputPath: string;
  skippedEncode: boolean;
  filename: string;
  encoderLabel?: string;
  clipCount?: number;
  /** Number of time ranges removed before compression (desktop trim). */
  trimSegmentCount?: number;
  /** Wall time spent in encode step(s). */
  encodeTimeMs?: number;
}

export interface WebCompressionResult extends CompressionResult {
  outputBlob: Blob;
  outputUrl: string;
  /** Wall time spent in FFmpeg encode step(s). */
  encodeTimeMs?: number;
  /** Total job time from start to result. */
  totalTimeMs?: number;
}

export interface BitrateCalculation {
  videoBitrateBps: number;
  audioBitrateBps: number;
  isScalingNeeded: boolean;
  maxDimension: number;
}

export interface EncodePass {
  bitrateMultiplier: number;
  maxDimensionOverride?: number;
  removeAudio: boolean;
}
