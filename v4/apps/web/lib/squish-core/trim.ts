export interface TrimSegment {
  startSec: number;
  endSec: number;
}

export type TrimValidationCode = 'outOfBounds' | 'nothingLeft' | 'invalidRange';
export type TrimDurationVerificationCode = 'tooShort' | 'tooLong';

export function parseTimestampToSeconds(ts: string): number | null {
  // Dots are a common time separator in Turkish ("1.30", "00.10"): with two
  // digits under 60 after each dot they mean minutes and seconds, not a fraction.
  const dotted = /^\d+(\.[0-5]\d){1,2}$/.test(ts.trim());
  const parts = (dotted ? ts.trim().replaceAll('.', ':') : ts.trim()).split(':');
  if (parts.length === 2) {
    const [m, s] = parts.map(Number);
    if (isNaN(m) || isNaN(s)) return null;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts.map(Number);
    if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
    return h * 3600 + m * 60 + s;
  }
  const n = Number(ts.trim());
  return isNaN(n) ? null : n;
}

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function parseDeleteRangeText(text: string): TrimSegment[] {
  const segments: TrimSegment[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(.+?)\s*[-–]\s*(.+)$/);
    if (!match) continue;
    const start = parseTimestampToSeconds(match[1]);
    const end = parseTimestampToSeconds(match[2]);
    if (start === null || end === null) continue;
    segments.push({ startSec: start, endSec: end });
  }
  return segments;
}

export function mergeTrimSegments(segments: TrimSegment[]): TrimSegment[] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a.startSec - b.startSec);
  const merged: TrimSegment[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].startSec <= last.endSec) {
      last.endSec = Math.max(last.endSec, sorted[i].endSec);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

export function deleteSegmentsToKeepSegments(
  deleteSegments: TrimSegment[],
  durationSec: number,
): TrimSegment[] {
  const keeps: TrimSegment[] = [];
  let cursor = 0;
  for (const del of deleteSegments) {
    if (del.startSec > cursor) {
      keeps.push({ startSec: cursor, endSec: del.startSec });
    }
    cursor = del.endSec;
  }
  if (cursor < durationSec) {
    keeps.push({ startSec: cursor, endSec: durationSec });
  }
  return keeps;
}

export function validateDeleteSegments(
  segments: TrimSegment[],
  durationSec: number,
): TrimValidationCode | null {
  if (segments.length === 0) return 'invalidRange';
  for (const seg of segments) {
    if (seg.startSec < 0 || seg.startSec >= seg.endSec) return 'invalidRange';
    if (seg.endSec > durationSec) return 'outOfBounds';
  }
  const keepSegments = deleteSegmentsToKeepSegments(segments, durationSec);
  if (keepSegments.length === 0) return 'nothingLeft';
  const keepDuration = keepSegments.reduce((s, seg) => s + (seg.endSec - seg.startSec), 0);
  if (keepDuration <= 0) return 'nothingLeft';
  return null;
}

export function totalKeepDuration(deleteSegments: TrimSegment[], durationSec: number): number {
  const keeps = deleteSegmentsToKeepSegments(deleteSegments, durationSec);
  return keeps.reduce((s, seg) => s + (seg.endSec - seg.startSec), 0);
}

export function totalDeletedDuration(deleteSegments: TrimSegment[]): number {
  return deleteSegments.reduce((s, seg) => s + (seg.endSec - seg.startSec), 0);
}

export function verifyTrimmedDuration(
  actual: number,
  expected: number,
  tolerance = 0.5,
): TrimDurationVerificationCode | null {
  if (actual < expected - tolerance) return 'tooShort';
  if (actual > expected + tolerance) return 'tooLong';
  return null;
}

export function estimateSourceBitrateBps(sizeBytes: number, durationSec: number): number {
  return (sizeBytes * 8) / Math.max(durationSec, 1);
}

export function proportionalSizeCeiling(
  sourceSizeBytes: number,
  keepDuration: number,
  totalDuration: number,
): number {
  const ratio = keepDuration / Math.max(totalDuration, 1);
  return sourceSizeBytes * ratio;
}
