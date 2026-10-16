/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsapSetup';
import { buildMascotGifTimeline } from './mascotGifTimelines';
import { mascotGifSrc, MASCOT_GIF_ALT, type MascotGifId } from './mascotGifs';

const SIZE_PX = {
  sm: 48,
  md: 64,
  lg: 80,
  xl: 96,
  hero: 112,
} as const;

interface MascotGifProps {
  id: MascotGifId;
  size?: keyof typeof SIZE_PX | number;
  loop?: boolean;
  intensity?: number;
  className?: string;
}

export default function MascotGif({
  id,
  size = 'lg',
  loop = true,
  intensity = 1,
  className = '',
}: MascotGifProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const px = typeof size === 'number' ? size : SIZE_PX[size];

  useGSAP(
    () => {
      if (!imgRef.current) return;
      timelineRef.current?.kill();
      const tl = buildMascotGifTimeline(imgRef.current, id, { loop, intensity });
      tl.timeScale(intensity);
      timelineRef.current = tl;
      return () => {
        tl.kill();
        timelineRef.current = null;
      };
    },
    { scope: scopeRef, dependencies: [id, loop], revertOnUpdate: true },
  );

  useGSAP(
    () => {
      if (timelineRef.current) {
        timelineRef.current.timeScale(intensity);
      }
    },
    { dependencies: [intensity], scope: scopeRef },
  );

  return (
    <div
      ref={scopeRef}
      className={`mascot-gif-frame inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
    >
      <img
        ref={imgRef}
        src={mascotGifSrc(id)}
        alt={MASCOT_GIF_ALT[id]}
        width={px}
        height={px}
        draggable={false}
        className="mascot-gif object-contain select-none w-full h-full"
      />
    </div>
  );
}
