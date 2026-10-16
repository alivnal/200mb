/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface MaterialIconProps {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
}

export default function MaterialIcon({
  name,
  className = '',
  filled = false,
  size = 24,
}: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-outlined notranslate ${className}`}
      translate="no"
      aria-hidden
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}`,
      }}
    >
      {name}
    </span>
  );
}
