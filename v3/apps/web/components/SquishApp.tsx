/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppStatus, type VideoMetadata, type WebCompressionResult } from '@/lib/squish-core';
import AppShell from '@/components/AppShell';
import ScreenTransition from '@/components/ScreenTransition';
import VideoSelector from '@/components/VideoSelector';
import CompressionStatus from '@/components/CompressionStatus';
import CompressionSuccess from '@/components/CompressionSuccess';
import CompressionError from '@/components/CompressionError';
import {
  cancelWasmCompression,
  compressVideoWasm,
  mergeAndCompressVideosWasm,
  type CompressionProgressSnapshot,
} from '@/lib/compress-wasm';

const INITIAL_SNAPSHOT: CompressionProgressSnapshot = {
  progress: 0,
  phase: 'preparing',
  phaseLabel: 'Preparing video…',
  elapsedMs: 0,
  encodeElapsedMs: null,
};

export default function SquishApp() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [progressSnap, setProgressSnap] = useState<CompressionProgressSnapshot>(INITIAL_SNAPSHOT);
  const [errorMessage, setErrorMessage] = useState('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [result, setResult] = useState<WebCompressionResult | null>(null);
  const [wasmLoading, setWasmLoading] = useState(false);
  const [isMergeJob, setIsMergeJob] = useState(false);

  const compressionSessionRef = useRef(0);
  const outputUrlRef = useRef<string | null>(null);
  const jobStartedAtRef = useRef<number | null>(null);
  const encodeStartedAtRef = useRef<number | null>(null);

  const revokeOutputUrl = () => {
    if (outputUrlRef.current) {
      URL.revokeObjectURL(outputUrlRef.current);
      outputUrlRef.current = null;
    }
  };

  useEffect(() => () => revokeOutputUrl(), []);

  const invalidateCompressionSession = () => {
    compressionSessionRef.current += 1;
    cancelWasmCompression();
    setIsMergeJob(false);
    jobStartedAtRef.current = null;
    encodeStartedAtRef.current = null;
  };

  const beginCompressionSession = () => {
    compressionSessionRef.current += 1;
    jobStartedAtRef.current = Date.now();
    encodeStartedAtRef.current = null;
    return compressionSessionRef.current;
  };

  const reset = () => {
    invalidateCompressionSession();
    revokeOutputUrl();
    setStatus(AppStatus.IDLE);
    setMetadata(null);
    setResult(null);
    setProgressSnap(INITIAL_SNAPSHOT);
    setErrorMessage('');
    setWasmLoading(false);
  };

  const handleCancel = () => {
    invalidateCompressionSession();
    revokeOutputUrl();
    setStatus(AppStatus.IDLE);
    setMetadata(null);
    setResult(null);
    setProgressSnap(INITIAL_SNAPSHOT);
    setErrorMessage('');
    setWasmLoading(false);
  };

  const handleProgress = (session: number, snap: CompressionProgressSnapshot) => {
    if (session !== compressionSessionRef.current) return;
    if (snap.encodeElapsedMs !== null && encodeStartedAtRef.current === null) {
      encodeStartedAtRef.current = Date.now() - snap.encodeElapsedMs;
    }
    setProgressSnap(snap);
  };

  const finishJob = async (session: number, compression: WebCompressionResult) => {
    if (session !== compressionSessionRef.current) {
      URL.revokeObjectURL(compression.outputUrl);
      return;
    }

    outputUrlRef.current = compression.outputUrl;
    setResult(compression);
    setProgressSnap((prev) => ({ ...prev, progress: 1, phaseLabel: 'Complete' }));
    setWasmLoading(false);
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    if (session !== compressionSessionRef.current) return;
    setStatus(AppStatus.DONE);
  };

  const handleJobError = (session: number, err: unknown) => {
    if (session !== compressionSessionRef.current) return;

    const message = err instanceof Error ? err.message : t('errors.compressionFailed');
    if (!message.toLowerCase().includes('cancel')) {
      setStatus(AppStatus.ERROR);
      setErrorMessage(message);
    } else {
      setStatus(AppStatus.IDLE);
      setMetadata(null);
      setResult(null);
      setProgressSnap(INITIAL_SNAPSHOT);
      setErrorMessage('');
    }
    setWasmLoading(false);
  };

  const startCompression = async (file: File) => {
    const session = beginCompressionSession();
    setIsMergeJob(false);

    setStatus(AppStatus.COMPRESSING);
    setProgressSnap(INITIAL_SNAPSHOT);
    setErrorMessage('');
    setResult(null);
    setWasmLoading(true);
    setMetadata({ name: file.name, size: file.size });

    try {
      const compression = await compressVideoWasm(file, {
        onLoadProgress: () => {
          if (session !== compressionSessionRef.current) return;
          setWasmLoading(false);
        },
        onProgress: (snap) => handleProgress(session, snap),
      });
      await finishJob(session, compression);
    } catch (err) {
      handleJobError(session, err);
    }
  };

  const startMergeAndCompress = async (files: File[]) => {
    const session = beginCompressionSession();
    setIsMergeJob(true);

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    setStatus(AppStatus.COMPRESSING);
    setProgressSnap(INITIAL_SNAPSHOT);
    setErrorMessage('');
    setResult(null);
    setWasmLoading(true);
    setMetadata({
      name: t('status.clipsMerged', { count: files.length }),
      size: totalSize,
    });

    try {
      const compression = await mergeAndCompressVideosWasm(files, {
        onLoadProgress: () => {
          if (session !== compressionSessionRef.current) return;
          setWasmLoading(false);
        },
        onProgress: (snap) => handleProgress(session, snap),
      });
      await finishJob(session, compression);
    } catch (err) {
      handleJobError(session, err);
    }
  };

  const jobPhase =
    isMergeJob && progressSnap.progress < 0.35 ? 'merging' : 'compressing';

  let content: React.ReactNode = null;

  if (status === AppStatus.IDLE) {
    content = (
      <VideoSelector
        onVideoSelected={startCompression}
        onMergeAndCompress={startMergeAndCompress}
        disabled={false}
      />
    );
  } else if (status === AppStatus.COMPRESSING && metadata) {
    content = (
      <CompressionStatus
        filename={metadata.name}
        progressSnap={progressSnap}
        jobStartedAt={jobStartedAtRef.current ?? Date.now()}
        encodeStartedAt={encodeStartedAtRef.current}
        originalSize={metadata.size}
        wasmLoading={wasmLoading}
        phase={jobPhase}
        onCancel={handleCancel}
      />
    );
  } else if (status === AppStatus.DONE && result) {
    content = <CompressionSuccess result={result} onReset={reset} />;
  } else if (status === AppStatus.ERROR) {
    content = <CompressionError message={errorMessage} onRetry={reset} />;
  }

  return (
    <AppShell>
      <ScreenTransition screenKey={status}>{content}</ScreenTransition>
    </AppShell>
  );
}
