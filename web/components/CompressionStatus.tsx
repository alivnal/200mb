/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useEffect, useState } from 'react';
import { formatBytes } from '@squish/core';
import AnimatedText from './AnimatedText';
import MaterialIcon from './MaterialIcon';
import BeaverCompressionScene from './mascot/BeaverCompressionScene';
import {
  PanelBody,
  PanelDivider,
  PanelFooter,
  PanelHeader,
  ScreenPanel,
} from './ScreenPanel';
import { formatElapsed, type CompressionProgressSnapshot } from '@/lib/compress-progress';

export type CompressionPhase = 'merging' | 'compressing';

interface CompressionStatusProps {
  filename: string;
  progressSnap: CompressionProgressSnapshot;
  jobStartedAt: number;
  encodeStartedAt: number | null;
  originalSize?: number;
  wasmLoading?: boolean;
  phase?: CompressionPhase;
  onCancel: () => void;
}

export default function CompressionStatus({
  filename,
  progressSnap,
  jobStartedAt,
  encodeStartedAt,
  originalSize,
  wasmLoading = false,
  phase = 'compressing',
  onCancel,
}: CompressionStatusProps) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsedMs = Date.now() - jobStartedAt;
  const encodeElapsedMs = encodeStartedAt ? Date.now() - encodeStartedAt : null;
  const percentage = Math.min(100, Math.max(0, Math.round(progressSnap.progress * 100)));

  const phaseTitle =
    phase === 'merging'
      ? 'Merging Videos…'
      : wasmLoading
        ? 'Loading Encoder…'
        : progressSnap.phaseLabel;

  return (
    <div className="screen-content text-ink overflow-hidden">
      <ScreenPanel size="lg" className="z-10">
        <PanelHeader>
          <div className="flex items-center justify-center gap-2 text-headline-sm font-semibold text-ink">
            <MaterialIcon name="movie" filled className="text-accent shrink-0" size={20} />
            <span className="truncate max-w-[min(100%,260px)]">{filename}</span>
          </div>
          <p className="mt-space-1 text-body-sm leading-5 text-muted font-mono">
            {originalSize
              ? `Original: ${formatBytes(originalSize)} · Target: under 200 MB`
              : 'Target: under 200 MB'}
          </p>
        </PanelHeader>

        <PanelDivider />

        <PanelBody className="flex flex-col items-center">
          <BeaverCompressionScene progress={progressSnap.progress} percentage={percentage} />

          <div className="mt-space-6 text-center w-full">
            <AnimatedText
              text={phaseTitle}
              as="p"
              className="text-headline-sm leading-[30px] font-semibold text-accent"
              colorAnimation="accent"
            />

            <div className="mt-space-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-body-sm text-muted font-mono">
              <span className="inline-flex items-center gap-1">
                <MaterialIcon name="timer" size={16} />
                Elapsed {formatElapsed(elapsedMs)}
              </span>
              {encodeElapsedMs !== null && (
                <span className="inline-flex items-center gap-1 text-accent">
                  <MaterialIcon name="movie_filter" size={16} />
                  Encoding {formatElapsed(encodeElapsedMs)}
                </span>
              )}
            </div>

            <p className="text-body-sm leading-5 text-muted mt-space-2 max-w-sm mx-auto">
              {wasmLoading
                ? 'First visit downloads ~25 MB of encoder code.'
                : 'Keep this tab open — progress tracks each stage of the job.'}
            </p>
          </div>
        </PanelBody>

        <PanelFooter>
          <button
            type="button"
            onClick={onCancel}
            className="btn-tactile w-full bg-surface hover:bg-gray-100 text-gray-700 text-label-md leading-[18px] min-h-11 py-2.5 px-6 rounded-lg border border-border transition-colors duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 cursor-pointer"
          >
            <MaterialIcon name="cancel" size={18} />
            Cancel Compression
          </button>
        </PanelFooter>
      </ScreenPanel>
    </div>
  );
}
