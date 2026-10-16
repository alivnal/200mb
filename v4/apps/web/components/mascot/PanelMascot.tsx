/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import dynamic from 'next/dynamic';
import { VARIANT_SEQUENCE, type PanelMascotVariant } from './mascotSvgSequences';

const MascotSvgSeq = dynamic(() => import('./MascotSvgSeq'), { ssr: false });

export type { PanelMascotVariant };

const SIZE_PX = {
  sm: 48,
  md: 64,
  lg: 80,
  xl: 96,
  hero: 112,
} as const;

interface PanelMascotProps {
  variant: PanelMascotVariant;
  size?: keyof typeof SIZE_PX;
  loop?: boolean;
  intensity?: number;
  className?: string;
}

export default function PanelMascot({
  variant,
  size = 'lg',
  loop = true,
  intensity = 1,
  className = '',
}: PanelMascotProps) {
  const sequence = VARIANT_SEQUENCE[variant];
  const playFrames = variant !== 'error';

  return (
    <MascotSvgSeq
      sequence={sequence}
      variant={variant}
      size={size}
      loop={loop}
      intensity={intensity}
      playFrames={playFrames}
      holdFrame={1}
      className={className}
    />
  );
}
