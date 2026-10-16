/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes, type WebCompressionResult } from '@/lib/squish-core';
import { formatElapsed } from '@/lib/compress-progress';
import MaterialIcon from './MaterialIcon';
import PanelMascot from './mascot/PanelMascot';
import { PanelBody, ScreenPanel } from './ScreenPanel';

interface CompressionSuccessProps {
  result: WebCompressionResult;
  onReset: () => void;
}

function savedPercent(original: number, compressed: number): number {
  if (original <= 0) return 0;
  return Math.max(0, Math.round(((original - compressed) / original) * 100));
}

export default function CompressionSuccess({ result, onReset }: CompressionSuccessProps) {
  const { t } = useTranslation();
  const percent = savedPercent(result.originalSize, result.compressedSize);

  const description = result.encoderLabel
    ? t('success.descriptionWithEncoder', { encoder: result.encoderLabel })
    : t('success.description');

  return (
    <div>
      <ScreenPanel size="2xl" className="z-10">
        <PanelBody className="text-center pt-space-6 pb-space-6">
          <div className="mx-auto mb-space-4 flex items-center justify-center">
            <PanelMascot variant="confetti" size="xl" />
          </div>

          <h1 className="text-[clamp(1.25rem,4vw,1.75rem)] leading-tight font-semibold text-ink mb-space-2">
            {t('success.titleBefore')}{' '}
            <span className="text-success">{t('success.titleAccent')}</span>
            {t('success.titleAfter')}
          </h1>
          <p className="text-body-sm leading-5 text-muted mb-space-6 max-w-md mx-auto">
            {description}
            {result.clipCount && result.clipCount > 1
              ? ` ${t('success.mergedFrom', { count: result.clipCount })}`
              : ''}
          </p>

          <div className="app-inset grid grid-cols-1 min-[480px]:grid-cols-2 min-[640px]:grid-cols-4 divide-y min-[480px]:divide-y-0 min-[480px]:divide-x divide-border">
            <div className="panel-stat">
              <span className="panel-stat-label">{t('success.saved')}</span>
              <span className="panel-stat-value text-headline-lg text-success">{percent}%</span>
            </div>
            <div className="panel-stat">
              <span className="panel-stat-label">{t('success.original')}</span>
              <span className="panel-stat-value text-headline-sm">{formatBytes(result.originalSize)}</span>
            </div>
            <div className="panel-stat">
              <span className="panel-stat-label">{t('success.newSize')}</span>
              <span className="panel-stat-value text-headline-sm text-accent">
                {formatBytes(result.compressedSize)}
              </span>
            </div>
            <div className="panel-stat">
              <span className="panel-stat-label">{t('success.encodeTime')}</span>
              <span className="panel-stat-value text-headline-sm">
                {result.encodeTimeMs != null ? formatElapsed(result.encodeTimeMs) : '—'}
              </span>
            </div>
          </div>

          <p className="mt-space-4 text-body-sm leading-5 text-muted break-all font-mono px-1">
            {result.filename}
          </p>

          <div className="action-btn-row">
            <a
              href={result.outputUrl}
              download={result.filename}
              className="pixel-btn no-underline"
            >
              <MaterialIcon name="download" size={18} />
              {t('success.downloadFile')}
            </a>
            <button type="button" onClick={onReset} className="pixel-btn pixel-btn-secondary">
              <MaterialIcon name="add_circle" size={18} />
              {t('success.compressAnother')}
            </button>
          </div>
        </PanelBody>
      </ScreenPanel>
    </div>
  );
}
