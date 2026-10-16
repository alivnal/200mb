/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import AnimatedText from './AnimatedText';
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
  return (
    <div className="screen-content overflow-hidden">
      <ScreenPanel size="lg" className="z-10">
        <PanelBody className="flex flex-col items-center text-center gap-space-4 pt-space-6">
          <PanelMascot variant="error" size="lg" />

          <div className="space-y-space-2">
            <AnimatedText
              text="Compression Failed"
              as="h2"
              className="text-headline-sm leading-[30px] font-semibold text-ink"
              animateDots={false}
              colorAnimation="ink"
            />
            <p className="text-body-sm leading-5 text-error">{message}</p>
          </div>
        </PanelBody>

        {onRetry && (
          <PanelFooter>
            <button
              type="button"
              onClick={onRetry}
              className="btn-tactile w-full bg-accent hover:bg-accent-hover text-white text-body-md leading-6 font-medium min-h-11 px-6 py-2.5 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <MaterialIcon name="refresh" size={20} />
              Try again
            </button>
          </PanelFooter>
        )}
      </ScreenPanel>
    </div>
  );
}
