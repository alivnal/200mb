/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes, type WebCompressionResult } from '@/lib/squish-core';
import { formatElapsed } from '@/lib/compress-progress';
import { nativeOutput } from '@/lib/platform';
import MaterialIcon from './MaterialIcon';
import PanelMascot from './mascot/PanelMascot';
import ShareTargets from './ShareTargets';
import { PanelBody, ScreenPanel } from './ScreenPanel';

/** Desktop only: where the result stands with the native Save sheet. */
type SaveState = { status: 'asking' | 'cancelled' } | { status: 'saved'; path: string };

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
  const [save, setSave] = useState<SaveState>({ status: 'asking' });
  const askedFor = useRef<string | null>(null);

  const saveResult = useCallback(async () => {
    if (!nativeOutput) return;
    setSave({ status: 'asking' });
    try {
      const path = await nativeOutput.save(result.outputUrl);
      setSave(path ? { status: 'saved', path } : { status: 'cancelled' });
    } catch (error) {
      console.error(error);
      setSave({ status: 'cancelled' });
    }
  }, [result.outputUrl]);

  // Desktop: ask where to keep the file as soon as it is ready, instead of a
  // download link; the ref keeps a re-run effect from asking twice.
  useEffect(() => {
    if (!nativeOutput || askedFor.current === result.outputUrl) return;
    askedFor.current = result.outputUrl;
    void saveResult();
  }, [result.outputUrl, saveResult]);

  const description = result.encoderLabel
    ? t('success.descriptionWithEncoder', { encoder: result.encoderLabel })
    : t('success.description');

  return (
    <div>
      <ScreenPanel size="2xl" className="z-10">
        <PanelBody className="text-center pt-space-6 pb-space-6">
          <div className="success-mascot mx-auto mb-space-4 flex items-center justify-center">
            <PanelMascot variant="confetti" size="xl" />
          </div>

          <h1 className="text-[clamp(1.375rem,4vw,1.875rem)] leading-tight text-ink mb-space-2">
            {t('success.titleBefore')}{' '}
            <span className="text-success">{t('success.titleAccent')}</span>
            {t('success.titleAfter')}
          </h1>
          <p className="text-body-sm leading-5 text-muted mb-space-6 max-w-md mx-auto">
            {description}
            {result.clipCount && result.clipCount > 1
              ? ` ${t('success.mergedFrom', { count: result.clipCount })}`
              : ''}
            {result.trimSegmentCount && result.trimSegmentCount > 0
              ? ` ${t('success.trimmedFrom', { count: result.trimSegmentCount })}`
              : ''}
          </p>

          <div className="success-stats">
            <div className="panel-stat success-stat">
              <span className="panel-stat-label">{t('success.saved')}</span>
              <span className="panel-stat-value text-headline-lg text-success">{percent}%</span>
            </div>
            <div className="panel-stat success-stat">
              <span className="panel-stat-label">{t('success.original')}</span>
              <span className="panel-stat-value text-headline-sm">{formatBytes(result.originalSize)}</span>
            </div>
            <div className="panel-stat success-stat">
              <span className="panel-stat-label">{t('success.newSize')}</span>
              <span className="panel-stat-value text-headline-sm text-accent">
                {formatBytes(result.compressedSize)}
              </span>
            </div>
            <div className="panel-stat success-stat">
              <span className="panel-stat-label">{t('success.encodeTime')}</span>
              <span className="panel-stat-value text-headline-sm">
                {result.encodeTimeMs != null ? formatElapsed(result.encodeTimeMs) : '—'}
              </span>
            </div>
          </div>

          <p className="mt-space-4 text-body-sm leading-5 text-muted break-all px-1">
            {save.status === 'saved' ? save.path : result.filename}
          </p>

          <div className="action-btn-row">
            {!nativeOutput ? (
              <a
                href={result.outputUrl}
                download={result.filename}
                className="pixel-btn no-underline"
              >
                <MaterialIcon name="download" size={18} />
                {t('success.downloadFile')}
              </a>
            ) : save.status === 'saved' ? (
              <button type="button" onClick={() => nativeOutput?.reveal(save.path)} className="pixel-btn">
                <MaterialIcon name="folder_open" size={18} />
                {t('success.showInFolder')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void saveResult()}
                disabled={save.status === 'asking'}
                className="pixel-btn"
              >
                <MaterialIcon name="download" size={18} />
                {t('success.downloadFile')}
              </button>
            )}
            <button type="button" onClick={onReset} className="pixel-btn pixel-btn-secondary">
              <MaterialIcon name="add_circle" size={18} />
              {t('success.compressAnother')}
            </button>
          </div>

          {nativeOutput && <ShareTargets outputUrl={result.outputUrl} actions={nativeOutput} />}
        </PanelBody>
      </ScreenPanel>
    </div>
  );
}
