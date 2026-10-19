/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NativeOutputActions, ShareTarget } from '@/lib/platform';

interface ShareTargetsProps {
  outputUrl: string;
  actions: NativeOutputActions;
}

const TARGETS: ShareTarget[] = ['drive', 'mail', 'slack', 'more'];

function TargetIcon({ target }: { target: ShareTarget }) {
  switch (target) {
    case 'drive':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="M8.2 3h7.6l6 10.4h-7.6z" fill="#FBBC04" />
          <path d="M2.2 13.4 8.2 3l3.8 6.6-6 10.4z" fill="#0F9D58" />
          <path d="M6 20l3.8-6.6h12L18 20z" fill="#4285F4" />
        </svg>
      );
    case 'slack':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <rect x="9.5" y="2" width="4" height="9" rx="2" fill="#36C5F0" />
          <rect x="13" y="9.5" width="9" height="4" rx="2" fill="#2EB67D" />
          <rect x="10.5" y="13" width="4" height="9" rx="2" fill="#ECB22E" />
          <rect x="2" y="10.5" width="9" height="4" rx="2" fill="#E01E5A" />
        </svg>
      );
    case 'mail':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
        </svg>
      );
    case 'more':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M12 15V3m0 0L8 7m4-4 4 4" />
          <path d="M8 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2" />
        </svg>
      );
  }
}

/** Desktop only: hand the finished video to Drive, Mail, Slack or the system share menu. */
export default function ShareTargets({ outputUrl, actions }: ShareTargetsProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<ShareTarget | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const share = async (target: ShareTarget) => {
    setBusy(target);
    setNote(null);
    try {
      const result = await actions.share(outputUrl, target);
      if (result === 'revealed') setNote(t('share.dragHint'));
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '') : '';
      setNote(t('share.failed', { message }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="share-targets" role="group" aria-label={t('share.title')}>
      <span className="share-targets-label">{t('share.title')}</span>
      <div className="share-targets-row">
        {TARGETS.map((target) => (
          <button
            key={target}
            type="button"
            className="share-target"
            disabled={busy !== null}
            aria-busy={busy === target}
            onClick={() => void share(target)}
          >
            <TargetIcon target={target} />
            <span>{t(`share.${target}`)}</span>
          </button>
        ))}
      </div>
      {note && (
        <p className="share-targets-note" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
