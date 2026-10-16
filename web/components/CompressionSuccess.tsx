/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import { formatBytes, type WebCompressionResult } from '@squish/core';
import { formatElapsed } from '@/lib/compress-progress';
import AnimatedText from './AnimatedText';
import MaterialIcon from './MaterialIcon';
import PanelMascot from './mascot/PanelMascot';
import {
  PanelBody,
  PanelFooter,
  ScreenPanel,
} from './ScreenPanel';

interface CompressionSuccessProps {
  result: WebCompressionResult;
  onReset: () => void;
}

function savedPercent(original: number, compressed: number): number {
  if (original <= 0) return 0;
  return Math.max(0, Math.round(((original - compressed) / original) * 100));
}

export default function CompressionSuccess({ result, onReset }: CompressionSuccessProps) {
  const percent = savedPercent(result.originalSize, result.compressedSize);

  return (
    <div className="screen-content text-ink overflow-hidden">
      <ScreenPanel size="2xl" className="z-10">
        <PanelBody className="text-center pt-space-6">
          <div className="mx-auto mb-space-4 flex items-center justify-center">
            <PanelMascot variant="confetti" size="xl" />
          </div>

          <AnimatedText
            text="Compression Complete!"
            as="h1"
            className="text-[clamp(1.25rem,4vw,1.75rem)] leading-tight font-semibold text-ink mb-space-2"
            animateDots={false}
            colorAnimation="accent"
          />
          <p className="text-body-sm leading-5 text-muted mb-space-6 max-w-md mx-auto">
            Your video has been successfully optimized
            {result.encoderLabel ? ` with ${result.encoderLabel}` : ''}.
            {result.clipCount && result.clipCount > 1
              ? ` Merged from ${result.clipCount} clips.`
              : ''}
          </p>

          <div className="app-inset grid grid-cols-1 min-[480px]:grid-cols-2 min-[640px]:grid-cols-4 divide-y min-[480px]:divide-y-0 min-[480px]:divide-x divide-border">
            <div className="panel-stat">
              <span className="panel-stat-label">Saved</span>
              <span className="panel-stat-value text-headline-lg text-success">{percent}%</span>
            </div>
            <div className="panel-stat">
              <span className="panel-stat-label">Original</span>
              <span className="panel-stat-value text-headline-sm">{formatBytes(result.originalSize)}</span>
            </div>
            <div className="panel-stat">
              <span className="panel-stat-label">New Size</span>
              <span className="panel-stat-value text-headline-sm text-accent">
                {formatBytes(result.compressedSize)}
              </span>
            </div>
            <div className="panel-stat">
              <span className="panel-stat-label">Encode Time</span>
              <span className="panel-stat-value text-headline-sm">
                {result.encodeTimeMs != null ? formatElapsed(result.encodeTimeMs) : '—'}
              </span>
            </div>
          </div>

          <p className="mt-space-4 text-body-sm leading-5 text-muted break-all font-mono px-1">
            {result.filename}
          </p>
        </PanelBody>

        <PanelFooter className="flex flex-col gap-space-3">
          <a
            href={result.outputUrl}
            download={result.filename}
            className="btn-tactile w-full bg-accent hover:bg-accent-hover text-white text-body-sm font-medium min-h-11 px-5 py-2.5 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer no-underline"
          >
            <MaterialIcon name="download" size={18} />
            Download File
          </a>
          <button
            type="button"
            onClick={onReset}
            className="btn-tactile w-full bg-surface hover:bg-gray-100 text-ink text-body-sm font-medium min-h-11 px-5 py-2.5 rounded-lg border border-border transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <MaterialIcon name="add_circle" size={18} />
            Compress Another
          </button>
        </PanelFooter>
      </ScreenPanel>
    </div>
  );
}
