/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {
  MAX_OUTPUT_BYTES,
  CompressionCancelledError,
  proportionalSizeCeiling,
  type BitrateCalculation,
  type TrimSegment,
  type VideoProbeMetadata,
  type WebCompressionResult,
} from '@/lib/squish-core';
import {
  WEB_DEGRADATION_PASSES,
  WEB_MAX_BITRATE_RETRIES,
  adjustBitrateForOvershoot,
  blueprintForWebPass,
  buildWasmLibx264FfmpegArgs,
  estimateWebStartPassIndex,
  maxWebCompressionAttempts,
} from './web-compress-strategy';
import { getI18nInstance, translatePhase } from '@squish/i18n';
import {
  CompressJobProgress,
  estimateUploadMs,
  formatElapsed,
  parseFfmpegLogTime,
  type CompressionProgressSnapshot,
} from './compress-progress';

function t(key: string): string {
  return getI18nInstance().t(key);
}
import { ENCODER_LABEL } from './platform';

const FFMPEG_CORE_VERSION = '0.12.6';
const WASM_OUTPUT_NAME = 'output.mp4';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
let activeSession = 0;

export type { CompressionProgressSnapshot };

export function extFromName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot) : '.mp4';
}

function basenameNoExt(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(0, dot) : base;
}

function scaleProgress(
  snap: CompressionProgressSnapshot,
  offset: number,
  span: number,
): CompressionProgressSnapshot {
  return {
    ...snap,
    progress: offset + snap.progress * span,
  };
}

export async function probeVideoFile(file: File): Promise<VideoProbeMetadata> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const meta = await new Promise<{ duration: number; width: number; height: number }>(
      (resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          resolve({
            duration: Number.isFinite(video.duration) ? video.duration : 0,
            width: video.videoWidth || 1920,
            height: video.videoHeight || 1080,
          });
        };
        video.onerror = () =>
          reject(new Error(t('errors.metadataReadFailed')));
        video.src = objectUrl;
      },
    );
    return {
      name: file.name,
      size: file.size,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function loadFFmpeg(onLoadProgress?: (ratio: number) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', () => {});

    const baseURL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    onLoadProgress?.(1);
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

export function cancelWasmCompression(): void {
  activeSession += 1;
  if (ffmpegInstance) {
    ffmpegInstance.terminate();
    ffmpegInstance = null;
    loadPromise = null;
  }
}

function isCancelled(session: number): boolean {
  return session !== activeSession;
}

async function readWasmFileBytes(ffmpeg: FFmpeg, name: string): Promise<Uint8Array> {
  const data = await ffmpeg.readFile(name);
  return data instanceof Uint8Array ? data : new TextEncoder().encode(data);
}

async function compressFromWasmFs(
  ffmpeg: FFmpeg,
  inputName: string,
  metadata: VideoProbeMetadata,
  hasAudio: boolean,
  session: number,
  jobProgress: CompressJobProgress,
  options?: {
    originalSize?: number;
    outputFilename?: string;
    clipCount?: number;
    trimSegmentCount?: number;
    skipEncodeMaxBytes?: number;
  },
): Promise<WebCompressionResult> {
  const {
    originalSize,
    outputFilename,
    clipCount,
    trimSegmentCount,
    skipEncodeMaxBytes,
  } = options ?? {};

  const filename = outputFilename ?? `${basenameNoExt(metadata.name)}_compressed.mp4`;
  const sourceSize = originalSize ?? metadata.size;

  const withinSkipCeiling =
    skipEncodeMaxBytes === undefined || metadata.size <= skipEncodeMaxBytes;

  if (metadata.size <= MAX_OUTPUT_BYTES && withinSkipCeiling) {
    jobProgress.finish();
    const bytes = await readWasmFileBytes(ffmpeg, inputName);
    const blob = new Blob([bytes], { type: 'video/mp4' });
    const outputUrl = URL.createObjectURL(blob);
    return {
      compressedSize: metadata.size,
      originalSize: sourceSize,
      outputPath: filename,
      skippedEncode: true,
      filename,
      encoderLabel: ENCODER_LABEL,
      outputBlob: blob,
      outputUrl,
      clipCount,
      trimSegmentCount,
      encodeTimeMs: 0,
      totalTimeMs: jobProgress.getTotalElapsedMs(),
    };
  }

  if (isCancelled(session)) throw new CompressionCancelledError();

  const startTierIndex = estimateWebStartPassIndex(metadata.duration, sourceSize);
  let tierIndex = startTierIndex;
  let bitrateRetriesLeft = WEB_MAX_BITRATE_RETRIES;
  let blueprint = blueprintForWebPass(tierIndex, metadata.duration);
  let attemptIndex = 0;
  let totalEncodeMs = 0;
  jobProgress.setEncodeAttempts(maxWebCompressionAttempts(startTierIndex));

  while (tierIndex < WEB_DEGRADATION_PASSES.length) {
    if (isCancelled(session)) throw new CompressionCancelledError();

    try {
      await ffmpeg.deleteFile(WASM_OUTPUT_NAME);
    } catch {
      // output may not exist yet
    }

    const encodeMs = await runWasmEncode(
      ffmpeg,
      inputName,
      WASM_OUTPUT_NAME,
      blueprint,
      hasAudio,
      metadata.duration,
      session,
      attemptIndex,
      jobProgress,
    );
    totalEncodeMs += encodeMs;
    attemptIndex++;

    jobProgress.enterPhase('finalizing', 0.3);
    const bytes = await readWasmFileBytes(ffmpeg, WASM_OUTPUT_NAME);
    const blob = new Blob([bytes], { type: 'video/mp4' });

    if (blob.size < MAX_OUTPUT_BYTES) {
      jobProgress.finish();
      const totalTimeMs = jobProgress.getTotalElapsedMs();
      console.info(
        `[Squish] Compression complete — encode ${formatElapsed(totalEncodeMs)}, total ${formatElapsed(totalTimeMs)}`,
      );
      const outputUrl = URL.createObjectURL(blob);
      return {
        compressedSize: blob.size,
        originalSize: sourceSize,
        outputPath: filename,
        skippedEncode: false,
        filename,
        encoderLabel: ENCODER_LABEL,
        outputBlob: blob,
        outputUrl,
        clipCount,
        trimSegmentCount,
        encodeTimeMs: totalEncodeMs,
        totalTimeMs,
      };
    }

    if (bitrateRetriesLeft > 0) {
      blueprint = adjustBitrateForOvershoot(blueprint, blob.size);
      bitrateRetriesLeft--;
      continue;
    }

    bitrateRetriesLeft = WEB_MAX_BITRATE_RETRIES;
    tierIndex++;
    if (tierIndex >= WEB_DEGRADATION_PASSES.length) break;
    blueprint = blueprintForWebPass(tierIndex, metadata.duration);
  }

  throw new Error(
    'Video too long or large to compress under 200 MB. Try a shorter clip or lower resolution source.',
  );
}

async function probeHasAudio(ffmpeg: FFmpeg, inputName: string): Promise<boolean> {
  const { probeHasAudioInFfmpeg } = await import('./trim-wasm');
  return probeHasAudioInFfmpeg(ffmpeg, inputName);
}

async function runWasmEncode(
  ffmpeg: FFmpeg,
  inputName: string,
  outputName: string,
  blueprint: BitrateCalculation,
  hasAudio: boolean,
  durationSeconds: number,
  session: number,
  attemptIndex: number,
  jobProgress: CompressJobProgress,
): Promise<number> {
  if (isCancelled(session)) throw new CompressionCancelledError();

  const args = buildWasmLibx264FfmpegArgs(inputName, outputName, blueprint, hasAudio);
  const encodeStarted = Date.now();
  let bestRatio = 0;

  const reportEncode = (ratio: number) => {
    bestRatio = Math.max(bestRatio, Math.min(0.995, ratio));
    jobProgress.setEncodeAttempt(attemptIndex, bestRatio);
  };

  const progressHandler = ({ progress }: { progress: number }) => {
    if (isCancelled(session)) return;
    if (durationSeconds > 0) {
      reportEncode(progress);
    }
  };

  const logHandler = ({ message }: { message: string }) => {
    if (isCancelled(session) || durationSeconds <= 0) return;
    const seconds = parseFfmpegLogTime(message);
    if (seconds !== null) {
      reportEncode(seconds / durationSeconds);
    }
  };

  jobProgress.setEncodeAttempt(attemptIndex, 0);
  ffmpeg.on('progress', progressHandler);
  ffmpeg.on('log', logHandler);

  try {
    const code = await ffmpeg.exec(args);
    if (isCancelled(session)) throw new CompressionCancelledError();
    if (code !== 0) {
      throw new Error(t('errors.encodingFailed'));
    }
    reportEncode(1);
    return Date.now() - encodeStarted;
  } finally {
    ffmpeg.off('progress', progressHandler);
    ffmpeg.off('log', logHandler);
  }
}

async function compressFileWithFfmpeg(
  file: File,
  metadata: VideoProbeMetadata,
  session: number,
  jobProgress: CompressJobProgress,
  options?: {
    onLoadProgress?: (progress: number) => void;
    originalSize?: number;
    outputFilename?: string;
    clipCount?: number;
    trimSegmentCount?: number;
    skipEncodeMaxBytes?: number;
  },
): Promise<WebCompressionResult> {
  const {
    onLoadProgress,
    originalSize,
    outputFilename,
    clipCount,
    trimSegmentCount,
    skipEncodeMaxBytes,
  } = options ?? {};

  const basename = basenameNoExt(file.name);
  const filename = outputFilename ?? `${basename}_compressed.mp4`;
  const sourceSize = originalSize ?? metadata.size;

  const withinSkipCeiling =
    skipEncodeMaxBytes === undefined || metadata.size <= skipEncodeMaxBytes;

  if (metadata.size <= MAX_OUTPUT_BYTES && withinSkipCeiling) {
    jobProgress.finish();
    const outputUrl = URL.createObjectURL(file);
    return {
      compressedSize: metadata.size,
      originalSize: sourceSize,
      outputPath: filename,
      skippedEncode: true,
      filename,
      encoderLabel: ENCODER_LABEL,
      outputBlob: file,
      outputUrl,
      clipCount,
      trimSegmentCount,
      encodeTimeMs: 0,
      totalTimeMs: jobProgress.getTotalElapsedMs(),
    };
  }

  jobProgress.enterPhase('loading', 0);
  const ffmpeg = await loadFFmpeg((ratio) => {
    jobProgress.update(ratio);
    if (ratio >= 1) onLoadProgress?.(1);
  });
  if (isCancelled(session)) throw new CompressionCancelledError();
  jobProgress.enterPhase('loading', 1);

  const inputName = `input${extFromName(file.name)}`;

  try {
    jobProgress.enterPhase('uploading', 0);
    const uploadStarted = Date.now();
    const uploadBudget = estimateUploadMs(file.size);
    const uploadTimer = window.setInterval(() => {
      if (isCancelled(session)) return;
      const ratio = Math.min(0.92, (Date.now() - uploadStarted) / uploadBudget);
      jobProgress.update(ratio);
    }, 250);

    await ffmpeg.writeFile(inputName, await fetchFile(file));
    window.clearInterval(uploadTimer);
    if (isCancelled(session)) throw new CompressionCancelledError();
    jobProgress.enterPhase('uploading', 1);

    const hasAudio = await probeHasAudio(ffmpeg, inputName);
    if (isCancelled(session)) throw new CompressionCancelledError();

    return compressFromWasmFs(ffmpeg, inputName, metadata, hasAudio, session, jobProgress, {
      originalSize,
      outputFilename,
      clipCount,
      trimSegmentCount,
      skipEncodeMaxBytes,
    });
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(WASM_OUTPUT_NAME).catch(() => {});
  }
}

export async function compressVideoWasm(
  file: File,
  options?: {
    onProgress?: (snapshot: CompressionProgressSnapshot) => void;
    onLoadProgress?: (progress: number) => void;
  },
): Promise<WebCompressionResult> {
  const session = activeSession;
  const { onProgress, onLoadProgress } = options ?? {};

  const jobProgress = new CompressJobProgress(onProgress);
  jobProgress.enterPhase('preparing', 0);

  const metadata = await probeVideoFile(file);
  if (isCancelled(session)) throw new CompressionCancelledError();
  jobProgress.enterPhase('preparing', 1);

  return compressFileWithFfmpeg(file, metadata, session, jobProgress, { onLoadProgress });
}

export async function mergeAndCompressVideosWasm(
  files: File[],
  options?: {
    onProgress?: (snapshot: CompressionProgressSnapshot) => void;
    onLoadProgress?: (progress: number) => void;
  },
): Promise<WebCompressionResult> {
  const session = activeSession;
  const { onProgress, onLoadProgress } = options ?? {};

  if (files.length < 2) {
    throw new Error(t('errors.mergeMinTwo'));
  }

  const { mergeVideosWasm } = await import('./merge-wasm');

  const mergeStarted = Date.now();
  onProgress?.({
    progress: 0.02,
    phase: 'preparing',
    phaseLabel: translatePhase('preparingMerge'),
    elapsedMs: 0,
    encodeElapsedMs: null,
  });

  const { blob, metadata, totalInputSize } = await mergeVideosWasm(files, {
    onLoadProgress,
    isCancelled: () => isCancelled(session),
    onProgress: (ratio) => {
      onProgress?.({
        progress: 0.04 + ratio * 0.31,
        phase: 'uploading',
        phaseLabel: translatePhase('mergingClips'),
        elapsedMs: Date.now() - mergeStarted,
        encodeElapsedMs: null,
      });
    },
  });

  if (isCancelled(session)) throw new CompressionCancelledError();

  const firstBasename = basenameNoExt(files[0].name);
  const mergedFile = new File([blob], `${firstBasename}_merged.mp4`, { type: 'video/mp4' });

  const compressReporter = new CompressJobProgress((snap) => {
    onProgress?.(scaleProgress(snap, 0.35, 0.65));
  });

  const result = await compressFileWithFfmpeg(mergedFile, metadata, session, compressReporter, {
    originalSize: totalInputSize,
    outputFilename: `${firstBasename}_merged_compressed.mp4`,
    clipCount: files.length,
  });

  console.info(`[Squish] Merge+compress — merge ${formatElapsed(Date.now() - mergeStarted)}`);
  return result;
}

export async function trimAndCompressVideosWasm(
  file: File,
  deleteSegments: TrimSegment[],
  options?: {
    onProgress?: (snapshot: CompressionProgressSnapshot) => void;
    onLoadProgress?: (progress: number) => void;
  },
): Promise<WebCompressionResult> {
  const session = activeSession;
  const { onProgress, onLoadProgress } = options ?? {};

  const sourceMeta = await probeVideoFile(file);
  if (isCancelled(session)) throw new CompressionCancelledError();

  const { resolveTrimSegments } = await import('./trim-wasm');
  const { totalKeepDuration } = resolveTrimSegments(deleteSegments, sourceMeta.duration);
  const skipCeiling = proportionalSizeCeiling(
    sourceMeta.size,
    sourceMeta.duration,
    totalKeepDuration,
  );

  const trimStarted = Date.now();
  const basename = basenameNoExt(file.name);
  const outputFilename = `${basename}_trimmed_compressed.mp4`;

  onProgress?.({
    progress: 0.02,
    phase: 'preparing',
    phaseLabel: translatePhase('preparing'),
    elapsedMs: 0,
    encodeElapsedMs: null,
  });

  const ffmpeg = await loadFFmpeg((ratio) => {
    onProgress?.({
      progress: 0.02 + ratio * 0.02,
      phase: 'loading',
      phaseLabel: translatePhase('loading'),
      elapsedMs: Date.now() - trimStarted,
      encodeElapsedMs: null,
    });
    if (ratio >= 1) onLoadProgress?.(1);
  });
  if (isCancelled(session)) throw new CompressionCancelledError();

  const { trimHybrid } = await import('./trim-hybrid');
  const hybridResult = await trimHybrid(file, deleteSegments, sourceMeta, {
    ffmpeg,
    isCancelled: () => isCancelled(session),
    onProgress: (ratio) => {
      onProgress?.({
        progress: 0.05 + ratio * 0.25,
        phase: 'uploading',
        phaseLabel: translatePhase('trimmingClips'),
        elapsedMs: Date.now() - trimStarted,
        encodeElapsedMs: null,
      });
    },
  });

  if (hybridResult) {
    const withinSkipCeiling =
      hybridResult.metadata.size <= skipCeiling;
    const canSkipCompress =
      hybridResult.metadata.size <= MAX_OUTPUT_BYTES && withinSkipCeiling;

    if (canSkipCompress) {
      onProgress?.({
        progress: 1,
        phase: 'finalizing',
        phaseLabel: translatePhase('finalizing'),
        elapsedMs: Date.now() - trimStarted,
        encodeElapsedMs: null,
      });
      const outputUrl = URL.createObjectURL(hybridResult.blob);
      return {
        compressedSize: hybridResult.metadata.size,
        originalSize: sourceMeta.size,
        outputPath: outputFilename,
        skippedEncode: true,
        filename: outputFilename,
        encoderLabel: ENCODER_LABEL,
        outputBlob: hybridResult.blob,
        outputUrl,
        trimSegmentCount: hybridResult.deleteSegmentCount,
        encodeTimeMs: 0,
        totalTimeMs: Date.now() - trimStarted,
      };
    }

    const hybridInputName = 'hybrid_trimmed.mp4';
    try {
      await ffmpeg.writeFile(hybridInputName, await fetchFile(hybridResult.blob));
      const compressReporter = new CompressJobProgress((snap) => {
        onProgress?.(scaleProgress(snap, 0.30, 0.70));
      });
      const result = await compressFromWasmFs(
        ffmpeg,
        hybridInputName,
        hybridResult.metadata,
        hybridResult.hasAudio,
        session,
        compressReporter,
        {
          originalSize: sourceMeta.size,
          outputFilename,
          trimSegmentCount: hybridResult.deleteSegmentCount,
          skipEncodeMaxBytes: skipCeiling,
        },
      );
      console.info(`[Squish] Trim+compress — hybrid ${formatElapsed(Date.now() - trimStarted)}`);
      return result;
    } finally {
      await ffmpeg.deleteFile(hybridInputName).catch(() => {});
      await ffmpeg.deleteFile(WASM_OUTPUT_NAME).catch(() => {});
    }
  }

  console.info('[Squish] Trim path: ffmpeg-fallback');

  const {
    trimVideoInFfmpeg,
    trimAndCompressInFfmpeg,
    TRIM_OUTPUT_NAME,
  } = await import('./trim-wasm');

  const inputName = `trim_source${extFromName(file.name)}`;
  const estimatedTrimmedBytes = Math.ceil(
    sourceMeta.size * (totalKeepDuration / Math.max(sourceMeta.duration, 0.001)),
  );
  const needsCompress =
    estimatedTrimmedBytes > skipCeiling || estimatedTrimmedBytes > MAX_OUTPUT_BYTES;

  try {
    onProgress?.({
      progress: 0.04,
      phase: 'uploading',
      phaseLabel: translatePhase('uploading'),
      elapsedMs: Date.now() - trimStarted,
      encodeElapsedMs: null,
    });

    const uploadStarted = Date.now();
    const uploadBudget = estimateUploadMs(file.size);
    const uploadTimer = window.setInterval(() => {
      if (isCancelled(session)) return;
      const ratio = Math.min(0.92, (Date.now() - uploadStarted) / uploadBudget);
      onProgress?.({
        progress: 0.04 + ratio * 0.01,
        phase: 'uploading',
        phaseLabel: translatePhase('uploading'),
        elapsedMs: Date.now() - trimStarted,
        encodeElapsedMs: null,
      });
    }, 250);

    await ffmpeg.writeFile(inputName, await fetchFile(file));
    window.clearInterval(uploadTimer);
    if (isCancelled(session)) throw new CompressionCancelledError();

    const trimProgress = (ratio: number) => {
      onProgress?.({
        progress: 0.05 + ratio * 0.25,
        phase: 'uploading',
        phaseLabel: translatePhase('trimmingClips'),
        elapsedMs: Date.now() - trimStarted,
        encodeElapsedMs: null,
      });
    };

    if (needsCompress) {
      const compressReporter = new CompressJobProgress((snap) => {
        onProgress?.(scaleProgress(snap, 0.30, 0.70));
      });

      const startTierIndex = estimateWebStartPassIndex(totalKeepDuration, sourceMeta.size);
      let tierIndex = startTierIndex;
      let bitrateRetriesLeft = WEB_MAX_BITRATE_RETRIES;
      let blueprint = blueprintForWebPass(tierIndex, totalKeepDuration);
      let attemptIndex = 0;
      let totalEncodeMs = 0;
      compressReporter.setEncodeAttempts(maxWebCompressionAttempts(startTierIndex));

      while (tierIndex < WEB_DEGRADATION_PASSES.length) {
        if (isCancelled(session)) throw new CompressionCancelledError();

        await ffmpeg.deleteFile(WASM_OUTPUT_NAME).catch(() => {});

        const encodeStarted = Date.now();
        const trimResult = await trimAndCompressInFfmpeg(
          ffmpeg,
          inputName,
          sourceMeta,
          deleteSegments,
          WASM_OUTPUT_NAME,
          blueprint,
          {
            isCancelled: () => isCancelled(session),
            onProgress: (ratio) => {
              trimProgress(ratio * 0.35);
              compressReporter.setEncodeAttempt(attemptIndex, ratio);
            },
          },
        );
        totalEncodeMs += Date.now() - encodeStarted;
        attemptIndex++;

        compressReporter.enterPhase('finalizing', 0.3);
        const bytes = await readWasmFileBytes(ffmpeg, WASM_OUTPUT_NAME);
        const blob = new Blob([bytes], { type: 'video/mp4' });

        if (blob.size < MAX_OUTPUT_BYTES) {
          compressReporter.finish();
          const outputUrl = URL.createObjectURL(blob);
          return {
            compressedSize: blob.size,
            originalSize: sourceMeta.size,
            outputPath: outputFilename,
            skippedEncode: false,
            filename: outputFilename,
            encoderLabel: ENCODER_LABEL,
            outputBlob: blob,
            outputUrl,
            trimSegmentCount: trimResult.deleteSegmentCount,
            encodeTimeMs: totalEncodeMs,
            totalTimeMs: Date.now() - trimStarted,
          };
        }

        if (bitrateRetriesLeft > 0) {
          blueprint = adjustBitrateForOvershoot(blueprint, blob.size);
          bitrateRetriesLeft--;
          continue;
        }

        bitrateRetriesLeft = WEB_MAX_BITRATE_RETRIES;
        tierIndex++;
        if (tierIndex >= WEB_DEGRADATION_PASSES.length) break;
        blueprint = blueprintForWebPass(tierIndex, totalKeepDuration);
      }

      throw new Error(
        'Video too long or large to compress under 200 MB. Try a shorter clip or lower resolution source.',
      );
    }

    const trimResult = await trimVideoInFfmpeg(ffmpeg, inputName, sourceMeta, deleteSegments, {
      isCancelled: () => isCancelled(session),
      onProgress: trimProgress,
    });

    if (isCancelled(session)) throw new CompressionCancelledError();

    const withinSkipCeiling = trimResult.metadata.size <= skipCeiling;
    if (trimResult.metadata.size <= MAX_OUTPUT_BYTES && withinSkipCeiling) {
      const bytes = await readWasmFileBytes(ffmpeg, trimResult.outputName);
      const blob = new Blob([bytes], { type: 'video/mp4' });
      const outputUrl = URL.createObjectURL(blob);
      return {
        compressedSize: trimResult.metadata.size,
        originalSize: sourceMeta.size,
        outputPath: outputFilename,
        skippedEncode: true,
        filename: outputFilename,
        encoderLabel: ENCODER_LABEL,
        outputBlob: blob,
        outputUrl,
        trimSegmentCount: trimResult.deleteSegmentCount,
        encodeTimeMs: 0,
        totalTimeMs: Date.now() - trimStarted,
      };
    }

    const compressReporter = new CompressJobProgress((snap) => {
      onProgress?.(scaleProgress(snap, 0.30, 0.70));
    });

    const result = await compressFromWasmFs(
      ffmpeg,
      trimResult.outputName,
      trimResult.metadata,
      trimResult.hasAudio,
      session,
      compressReporter,
      {
        originalSize: sourceMeta.size,
        outputFilename,
        trimSegmentCount: trimResult.deleteSegmentCount,
        skipEncodeMaxBytes: skipCeiling,
      },
    );

    console.info(`[Squish] Trim+compress — ffmpeg ${formatElapsed(Date.now() - trimStarted)}`);
    return result;
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(TRIM_OUTPUT_NAME).catch(() => {});
    await ffmpeg.deleteFile(WASM_OUTPUT_NAME).catch(() => {});
  }
}
