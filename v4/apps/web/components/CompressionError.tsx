/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import MaterialIcon from './MaterialIcon';
import PanelMascot from './mascot/PanelMascot';
import {
  PanelBody,
  PanelFooter,
  ScreenPanel,
} from './ScreenPanel';

interface CompressionErrorProps {
  message: string;
  onRetry?: () => void;
}

export default function CompressionError({ message, onRetry }: CompressionErrorProps) {
  const { t } = useTranslation();

  return (
    <div>
      <ScreenPanel size="lg" className="z-10">
        <PanelBody className="flex flex-col items-center text-center gap-space-4 pt-space-6">
          <PanelMascot variant="error" size="lg" />

          <div className="space-y-space-2">
            <h2 className="text-headline-sm leading-[30px] text-ink">
              {t('errors.compressionFailedTitle')}
            </h2>
            <p className="text-body-sm leading-5 text-error">{message}</p>
          </div>
        </PanelBody>

        {onRetry && (
          <PanelFooter>
            <button
              type="button"
              onClick={onRetry}
              className="pixel-btn pixel-btn-block"
            >
              <MaterialIcon name="refresh" size={20} />
              {t('common.tryAgain')}
            </button>
          </PanelFooter>
        )}
      </ScreenPanel>
    </div>
  );
}
