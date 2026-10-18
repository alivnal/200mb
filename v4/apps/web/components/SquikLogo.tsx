/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface SquikLogoProps {
  className?: string;
  compact?: boolean;
}

export default function SquikLogo({ className = '', compact = false }: SquikLogoProps) {
  return (
    <span className={`squik-brand ${compact ? 'squik-brand-compact' : ''} ${className}`.trim()}>
      <img
        className="squik-brand-mark"
        src="/icon.svg"
        alt=""
        width="48"
        height="48"
        aria-hidden="true"
      />
      {!compact && <span className="squik-brand-name">squik</span>}
    </span>
  );
}
