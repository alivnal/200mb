/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface SquikLogoProps {
  className?: string;
  height?: number;
}

export default function SquikLogo({ className = 'h-16 w-auto', height }: SquikLogoProps) {
  return (
    <img
      src="/squik-logo.svg"
      alt="Squik"
      className={`mx-auto object-contain ${className}`}
      style={height ? { height } : undefined}
    />
  );
}
