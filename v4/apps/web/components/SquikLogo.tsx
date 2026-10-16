/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface SquikLogoProps {
  className?: string;
  size?: number;
}

/**
 * SQUIK wordmark — geometric stroke letters + lightning bolt accent.
 * Uses currentColor for the letterforms so it adapts to light/dark mode.
 * The bolt is always accent-blue (#0e71fb / #5ba3ff in dark).
 */
export default function SquikLogo({ className = '', size = 48 }: SquikLogoProps) {
  const w = Math.round(size * (280 / 64));
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 280 64"
      width={w}
      height={size}
      fill="none"
      aria-label="Squik"
      role="img"
      className={className}
    >
      {/* S */}
      <path
        d="M8 14h24a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6H14a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h24"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Q */}
      <circle cx="68" cy="32" r="18" stroke="currentColor" strokeWidth="7" />
      <line x1="80" y1="44" x2="90" y2="54" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      {/* U */}
      <path
        d="M106 14v28a10 10 0 0 0 20 0V14"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* I */}
      <line x1="148" y1="14" x2="148" y2="50" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <line x1="140" y1="14" x2="156" y2="14" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <line x1="140" y1="50" x2="156" y2="50" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      {/* K */}
      <line x1="170" y1="14" x2="170" y2="50" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path
        d="M170 32 L192 14"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M170 32 L192 50"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* ⚡ Lightning bolt accent */}
      <path d="M210 10 L202 32 L208 32 L200 54 L214 28 L208 28 Z" fill="var(--color-accent, #0e71fb)" />
    </svg>
  );
}
