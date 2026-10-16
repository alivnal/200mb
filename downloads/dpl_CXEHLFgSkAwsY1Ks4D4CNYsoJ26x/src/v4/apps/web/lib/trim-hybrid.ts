/**
 * Fast hybrid trim: Mediabunny stream-copy with automatic boundary transcode.
 * Falls back to FFmpeg.wasm when unsupported.
 *
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BlobSource,
  BufferTarget,
  Conversion,
  EncodedPacketSink,
  Input,
  Mp4InputFormat,
  Mp4OutputFormat,
  Output,
} from 'mediabunny';
import {
  CompressionCancelledError,
  type TrimSegment,
  type VideoProbeMetadata,
} from '@/lib/squish-core';
import { resolveTrimSegments } from './trim-wasm';

export type TrimHybridPath = 'hybrid-copy' | 'ffmpeg-fallback';

export interface TrimHybridResult {
  blob: Blob;
  metadata: VideoProbeMetadata;
  deleteSegmentCount: number;
  hasAudio: boolean;
  totalKeepDuration: number;
  path: TrimHybridPath;
  /** Max seconds a cut may extend to the preceding keyframe (UI hint). */
  maxBoundarySnapSec: number;
}

const HYBRID_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov']);

function extLower(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function nearestKeyframeDistance(times: number[], cutSec: number): number {
  if (times.length === 0) return 0;
  let best = Infinity;
  for (const t of times) {
    if (t <= cutSec) best = Math.min(best, cutSec - t);
  }
  return Number.isFinite(best) ? best : 0;
}

/** Whether this file is a candidate for Mediabunny hybrid trim. */
export async function canUseHybridTrim(file: File): Promise<boolean> {
  if (!HYBRID_EXTENSIONS.has(extLower(file.name))) return false;
  if (file.size === 0) return false;

  try {
    const input = new Input({
      formats: [new Mp4InputFormat()],
      source: new BlobSource(file),
    });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) return false;

    const codec = await videoTrack.getCodec();
    if (codec !== 'avc') return false;

    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
    });
    return conversion.isValid;
  } catch {
    return false;
  }
}

/** Keyframe timestamps (seconds) for boundary-snap UI hints. */
export async function probeKeyframeTimes(file: File): Promise<number[]> {
  const input = new Input({
    formats: [new Mp4InputFormat()],
    source: new BlobSource(file),
  });
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) return [];

  const sink = new EncodedPacketSink(videoTrack);
  const times: number[] = [];
  let packet = await sink.getFirstKeyPacket();
  while (packet) {
    times.push(packet.timestamp);
    packet = await sink.getNextKeyPacket(packet);
  }
  return times;
}

async function extractKeepSegment(
  file: File,
  segment: { startSec: number; endSec: number },
  options?: {
    onProgress?: (ratio: number) => void;
    isCancelled?: () => boolean;
  },
): Promise<Uint8Array> {
  const { onProgress, isCancelled } = options ?? {};

  const input = new Input({
    formats: [new Mp4InputFormat()],
    source: new BlobSource(file),
  });
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });

  const conversion = await Conversion.init({
    input,
    output,
    tracks: 'primary',
    trim: {
      start: segment.startSec,
      end: segment.endSec,
    },
  });

  if (!conversion.isValid) {
    throw new Error('Hybrid trim conversion invalid');
  }

  conversion.onProgress = (progress) => {
    if (isCancelled?.()) return;
    onProgress?.(progress);
  };

  if (isCancelled?.()) throw new CompressionCancelledError();
  await conversion.execute();
  if (isCancelled?.()) throw new CompressionCancelledError();

  const buffer = output.target.buffer;
  if (!buffer) throw new Error('Hybrid trim produced no output');
  return new Uint8Array(buffer);
}

async function concatMp4Parts(
  ffmpeg: import('@ffmpeg/ffmpeg').FFmpeg,
  parts: Uint8Array[],
  outputName: string,
): Promise<void> {
  const listName = 'concat_list.txt';
  const partNames: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const partName = `hybrid_part_${i}.mp4`;
    await ffmpeg.writeFile(partName, parts[i]);
    partNames.push(partName);
  }

  const listContent = partNames.map((name) => `file '${name}'`).join('\n');
  await ffmpeg.writeFile(listName, listContent);

  const code = await ffmpeg.exec([
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listName,
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    outputName,
  ]);

  await ffmpeg.deleteFile(listName).catch(() => {});
  for (const partName of partNames) {
    await ffmpeg.deleteFile(partName).catch(() => {});
  }

  if (code !== 0) {
    throw new Error('Hybrid concat failed');
  }
}

/**
 * Mediabunny hybrid trim: copy packets where possible, transcode at cut boundaries.
 * Returns null when caller should use FFmpeg fallback.
 */
export async function trimHybrid(
  file: File,
  deleteSegments: TrimSegment[],
  sourceMeta: VideoProbeMetadata,
  options?: {
    ffmpeg?: import('@ffmpeg/ffmpeg').FFmpeg;
    onProgress?: (ratio: number) => void;
    isCancelled?: () => boolean;
  },
): Promise<TrimHybridResult | null> {
  const { ffmpeg, onProgress, isCancelled } = options ?? {};

  if (!(await canUseHybridTrim(file))) return null;

  const { mergedDeletes, keepSegments, totalKeepDuration } = resolveTrimSegments(
    deleteSegments,
    sourceMeta.duration,
  );

  let keyframeTimes: number[] = [];
  try {
    keyframeTimes = await probeKeyframeTimes(file);
  } catch {
    return null;
  }

  const cutPoints = new Set<number>();
  for (const seg of keepSegments) {
    cutPoints.add(seg.startSec);
    cutPoints.add(seg.endSec);
  }
  let maxBoundarySnapSec = 0;
  for (const cut of cutPoints) {
    maxBoundarySnapSec = Math.max(maxBoundarySnapSec, nearestKeyframeDistance(keyframeTimes, cut));
  }

  const partBytes: Uint8Array[] = [];
  const segmentSpan = 0.9 / Math.max(keepSegments.length, 1);

  for (let i = 0; i < keepSegments.length; i++) {
    if (isCancelled?.()) throw new CompressionCancelledError();

    const segment = keepSegments[i];
    const segmentOffset = 0.05 + i * segmentSpan;

    try {
      const bytes = await extractKeepSegment(file, segment, {
        isCancelled,
        onProgress: (ratio) => {
          onProgress?.(segmentOffset + ratio * segmentSpan);
        },
      });
      partBytes.push(bytes);
    } catch {
      return null;
    }
  }

  if (isCancelled?.()) throw new CompressionCancelledError();

  let finalBytes: Uint8Array;
  if (partBytes.length === 1) {
    finalBytes = partBytes[0];
  } else {
    if (!ffmpeg) return null;
    const mergedName = 'hybrid_merged.mp4';
    try {
      await concatMp4Parts(ffmpeg, partBytes, mergedName);
      const data = await ffmpeg.readFile(mergedName);
      finalBytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
      await ffmpeg.deleteFile(mergedName).catch(() => {});
    } catch {
      return null;
    }
  }

  onProgress?.(1);

  const blob = new Blob([finalBytes], { type: 'video/mp4' });
  const input = new Input({
    formats: [new Mp4InputFormat()],
    source: new BlobSource(blob),
  });
  const hasAudio = (await input.getPrimaryAudioTrack()) !== null;

  console.info('[Squish] Trim path: hybrid-copy');

  return {
    blob,
    metadata: {
      name: sourceMeta.name,
      size: blob.size,
      duration: totalKeepDuration,
      width: sourceMeta.width,
      height: sourceMeta.height,
    },
    deleteSegmentCount: mergedDeletes.length,
    hasAudio,
    totalKeepDuration,
    path: 'hybrid-copy',
    maxBoundarySnapSec,
  };
}
