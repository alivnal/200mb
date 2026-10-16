/**
 * Phase-weighted compression progress with elapsed / encode timers.
 */

import { translatePhase, type CompressionPhaseKey } from '@squish/i18n';

export type CompressionPhase =
  | 'preparing'
  | 'loading'
  | 'uploading'
  | 'encoding'
  | 'finalizing';

export interface CompressionProgressSnapshot {
  progress: number;
  phase: CompressionPhase;
  phaseLabel: string;
  elapsedMs: number;
  encodeElapsedMs: number | null;
}

function phaseLabel(phase: CompressionPhase): string {
  return translatePhase(phase as CompressionPhaseKey);
}

  /** Cumulative progress ceiling per phase (0–1). */
const PHASE_END: Record<CompressionPhase, number> = {
  preparing: 0.04,
  loading: 0.12,
  uploading: 0.30,
  encoding: 0.97,
  finalizing: 1,
};

const PHASE_START: Record<CompressionPhase, number> = {
  preparing: 0,
  loading: PHASE_END.preparing,
  uploading: PHASE_END.loading,
  encoding: PHASE_END.uploading,
  finalizing: PHASE_END.encoding,
};

export function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function parseFfmpegLogTime(message: string): number | null {
  const match = message.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

/** Rough upload-to-WASM-FS duration from file size. */
export function estimateUploadMs(bytes: number): number {
  return Math.max(4000, (bytes / (70 * 1024 * 1024)) * 1000);
}

export class CompressJobProgress {
  private readonly startedAt = Date.now();
  private encodeStartedAt: number | null = null;
  private lastProgress = 0;
  private phase: CompressionPhase = 'preparing';
  private encodeAttempt = 0;
  private encodeAttemptCount = 1;

  constructor(private emit?: (snapshot: CompressionProgressSnapshot) => void) {}

  setEncodeAttempts(count: number) {
    this.encodeAttemptCount = Math.max(1, count);
  }

  private snapshot(withinPhase: number): CompressionProgressSnapshot {
    const start = PHASE_START[this.phase];
    const end = PHASE_END[this.phase];
    let progress = start + (end - start) * Math.max(0, Math.min(1, withinPhase));

    if (this.phase === 'encoding') {
      const encodeSpan = PHASE_END.encoding - PHASE_START.encoding;
      const attemptSpan = encodeSpan / this.encodeAttemptCount;
      const attemptBase = PHASE_START.encoding + this.encodeAttempt * attemptSpan;
      progress = attemptBase + attemptSpan * Math.max(0, Math.min(1, withinPhase));
    }

    this.lastProgress = Math.max(this.lastProgress, Math.min(0.999, progress));

    return {
      progress: this.lastProgress,
      phase: this.phase,
      phaseLabel: phaseLabel(this.phase),
      elapsedMs: Date.now() - this.startedAt,
      encodeElapsedMs: this.encodeStartedAt ? Date.now() - this.encodeStartedAt : null,
    };
  }

  private publish(withinPhase: number) {
    this.emit?.(this.snapshot(withinPhase));
  }

  enterPhase(next: CompressionPhase, withinPhase = 0) {
    this.phase = next;
    if (next === 'encoding' && this.encodeStartedAt === null) {
      this.encodeStartedAt = Date.now();
    }
    this.publish(withinPhase);
  }

  update(withinPhase: number) {
    this.publish(withinPhase);
  }

  setEncodeAttempt(index: number, withinAttempt = 0) {
    this.encodeAttempt = index;
    this.phase = 'encoding';
    if (this.encodeStartedAt === null) {
      this.encodeStartedAt = Date.now();
    }
    this.publish(withinAttempt);
  }

  finish() {
    this.lastProgress = 1;
    this.emit?.({
      progress: 1,
      phase: 'finalizing',
      phaseLabel: translatePhase('complete'),
      elapsedMs: Date.now() - this.startedAt,
      encodeElapsedMs: this.encodeStartedAt ? Date.now() - this.encodeStartedAt : null,
    });
  }

  getTotalElapsedMs(): number {
    return Date.now() - this.startedAt;
  }

  getEncodeElapsedMs(): number | null {
    return this.encodeStartedAt ? Date.now() - this.encodeStartedAt : null;
  }
}
