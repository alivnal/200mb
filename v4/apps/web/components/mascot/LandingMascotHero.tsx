/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import SquikLogo from '@/components/SquikLogo';
import PanelMascot from './PanelMascot';

export default function LandingMascotHero() {
  return (
    <div className="flex flex-col items-center gap-3">
      <SquikLogo size={44} className="text-ink" />
      <PanelMascot variant="walky" size="hero" />
    </div>
  );
}
