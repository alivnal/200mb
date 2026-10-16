import type { TrimSegment } from './types';

export type TrimValidationCode =
  | 'emptyInput'
  | 'invalidRange'
  | 'invalidOrder'
  | 'outOfBounds'
  | 'nothingLeft';

export type TrimDurationVerificationCode = 'notRemovedEnough' | 'removedTooMuch';

const RANGE_SPLIT_RE = /[\n,;]+/;
const RANGE_PAIR_RE = /^(.+?)\s*[-–—]\s*(.+)$/;

/** Parse `MM:SS`, `H:MM:SS`, or plain seconds. */
export function parseTimestampToSeconds(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('empty');

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  const parts = trimmed.split(':').map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3) {
    throw new Error('invalid');
  }

  const nums = parts.map((part) => {
    if (!/^\d{1,2}$/.test(part) && !/^\d+$/.test(part)) {
      throw new Error('invalid');
    }
    return Number(part);
  });

  if (parts.length === 2) {
    const [minutes, seconds] = nums;
    if (seconds >= 60) throw new Error('invalid');
    return minutes * 60 + seconds;
  }

  const [hours, minutes, seconds] = nums;
  if (minutes >= 60 || seconds >= 60) throw new Error('invalid');
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function parseDeleteRangeText(text: string): TrimSegment[] {
  const tokens = text
    .split(RANGE_SPLIT_RE)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new Error('emptyInput');
  }

  const segments: TrimSegment[] = [];

  for (const token of tokens) {
    const match = token.match(RANGE_PAIR_RE);
    if (!match) {
      throw new Error('invalidRange');
    }

    const startSec = parseTimestampToSeconds(match[1]);
    const endSec = parseTimestampToSeconds(match[2]);

    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || startSec >= endSec) {
      throw new Error('invalidOrder');
    }

    segments.push({ startSec, endSec });
  }

  return mergeTrimSegments(segments);
}

export function mergeTrimSegments(segments: TrimSegment[]): TrimSegment[] {
  if (segments.length === 0) return [];

  const sorted = [...segments].sort((a, b) => a.startSec - b.startSec);
  const merged: TrimSegment[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.startSec <= last.endSec) {
      last.endSec = Math.max(last.endSec, current.endSec);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/** Invert delete ranges into keep ranges within [0, duration]. */
export function deleteSegmentsToKeepSegments(
  deleteSegments: TrimSegment[],
  durationSec: number,
): TrimSegment[] {
  const merged = mergeTrimSegments(deleteSegments);
  const keep: TrimSegment[] = [];
  let cursor = 0;

  for (const segment of merged) {
    const start = Math.max(0, segment.startSec);
    const end = Math.min(durationSec, segment.endSec);
    if (start > cursor) {
      keep.push({ startSec: cursor, endSec: start });
    }
    cursor = Math.max(cursor, end);
  }

  if (cursor < durationSec) {
    keep.push({ startSec: cursor, endSec: durationSec });
  }

  return keep.filter((segment) => segment.endSec - segment.startSec > 0.05);
}

export function validateDeleteSegments(
  deleteSegments: TrimSegment[],
  durationSec: number,
): TrimValidationCode | null {
  if (deleteSegments.length === 0) return 'emptyInput';
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 'outOfBounds';

  for (const segment of deleteSegments) {
    if (segment.startSec < 0 || segment.endSec > durationSec + 0.01) {
      return 'outOfBounds';
    }
    if (segment.startSec >= segment.endSec) {
      return 'invalidOrder';
    }
  }

  const keep = deleteSegmentsToKeepSegments(deleteSegments, durationSec);
  if (keep.length === 0) return 'nothingLeft';

  return null;
}

export function totalKeepDuration(
  deleteSegments: TrimSegment[],
  durationSec: number,
): number {
  return deleteSegmentsToKeepSegments(deleteSegments, durationSec).reduce(
    (sum, segment) => sum + (segment.endSec - segment.startSec),
    0,
  );
}

export function totalDeletedDuration(deleteSegments: TrimSegment[]): number {
  return deleteSegments.reduce((sum, segment) => sum + (segment.endSec - segment.startSec), 0);
}

/**
 * Check that trimmed output duration reflects the deleted ranges.
 * Tolerates re-encode frame rounding; fails when sections were clearly not removed.
 */
export function verifyTrimmedDuration(
  originalDurationSec: number,
  trimmedDurationSec: number,
  deleteSegments: TrimSegment[],
): TrimDurationVerificationCode | null {
  const deletedDuration = totalDeletedDuration(deleteSegments);
  const expectedMin = originalDurationSec - deletedDuration;
  const highSlop = Math.max(3, deletedDuration * 0.05);
  const lowSlop = Math.max(5, originalDurationSec * 0.01);

  if (trimmedDurationSec > expectedMin + highSlop) {
    return 'notRemovedEnough';
  }
  if (trimmedDurationSec < expectedMin - lowSlop) {
    return 'removedTooMuch';
  }
  return null;
}

/** Approximate overall bitrate from file size and duration. */
export function estimateSourceBitrateBps(sizeBytes: number, durationSec: number): number {
  const safeDuration = Math.max(durationSec, 0.1);
  return (sizeBytes * 8) / safeDuration;
}

/** Max bytes allowed after trim before forcing a compress pass (5% headroom). */
export function proportionalSizeCeiling(
  originalSizeBytes: number,
  originalDurationSec: number,
  trimmedDurationSec: number,
): number {
  const safeOriginalDuration = Math.max(originalDurationSec, 0.1);
  const ratio = trimmedDurationSec / safeOriginalDuration;
  return Math.ceil(originalSizeBytes * ratio * 1.05);
}
