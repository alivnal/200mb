/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsapSetup';
import {
  MASCOT_SEQUENCES,
  mascotSeqFrameUrls,
  type MascotSeqId,
  type PanelMascotVariant,
} from './mascotSvgSequences';
import { buildFrameSequenceTimeline, buildMascotWrapperTimeline } from './mascotSvgSeqTimelines';

const SEQUENCE_VARIANT: Record<MascotSeqId, PanelMascotVariant> = {
  wave: 'walky',
  gym: 'gym',
  sleep: 'confetti',
};

const SIZE_PX = {
  sm: 48,
  md: 64,
  lg: 80,
  xl: 96,
  hero: 112,
} as const;

interface MascotSvgSeqProps {
  sequence: MascotSeqId;
  variant?: PanelMascotVariant;
  size?: keyof typeof SIZE_PX | number;
  loop?: boolean;
  intensity?: number;
  playFrames?: boolean;
  holdFrame?: number;
  className?: string;
}

export default function MascotSvgSeq({
  sequence,
  variant,
  size = 'lg',
  loop = true,
  intensity = 1,
  playFrames = true,
  holdFrame = 1,
  className = '',
}: MascotSvgSeqProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const frameTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const wrapperTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const seq = MASCOT_SEQUENCES[sequence];
  const frameUrls = useMemo(() => mascotSeqFrameUrls(seq), [seq]);
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  const motionVariant = variant ?? SEQUENCE_VARIANT[sequence];
  const holdUrl = frameUrls[Math.max(0, holdFrame - 1)] ?? frameUrls[0];

  useEffect(() => {
    frameUrls.forEach((url) => {
      const preload = new Image();
      preload.src = url;
      void preload.decode?.();
    });
  }, [frameUrls]);

  useGSAP(
    () => {
      const img = imgRef.current;
      const wrapper = wrapperRef.current;
      frameTimelineRef.current?.kill();
      frameTimelineRef.current = null;
      wrapperTimelineRef.current?.kill();
      wrapperTimelineRef.current = null;

      if (!img || !wrapper || typeof window === 'undefined') return;

      const mm = gsap.matchMedia();

      mm.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
          motionOk: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const reduceMotion = Boolean(context.conditions?.reduceMotion);

          if (reduceMotion || !playFrames) {
            img.src = holdUrl;
            gsap.set(wrapper, { scale: 1, y: 0, rotation: 0 });
            return;
          }

          const frameTl = buildFrameSequenceTimeline(img, frameUrls, seq, { loop });
          frameTimelineRef.current = frameTl;

          const wrapperTl = buildMascotWrapperTimeline(wrapper, motionVariant, seq, {
            loop,
            intro: true,
          });
          wrapperTimelineRef.current = wrapperTl;

          return () => {
            frameTl.kill();
            frameTimelineRef.current = null;
            wrapperTl.kill();
            wrapperTimelineRef.current = null;
          };
        },
      );

      return () => {
        mm.revert();
      };
    },
    {
      scope: scopeRef,
      dependencies: [sequence, loop, playFrames, holdFrame, motionVariant],
      revertOnUpdate: true,
    },
  );

  useGSAP(
    () => {
      const tl = frameTimelineRef.current;
      if (!tl) return;
      tl.timeScale(Math.max(0.25, intensity));
    },
    { dependencies: [intensity], scope: scopeRef },
  );

  return (
    <div
      ref={scopeRef}
      className={`mascot-seq-frame inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
    >
      <div
        ref={wrapperRef}
        className="mascot-seq-wrapper relative w-full h-full"
        style={{ width: px, height: px }}
      >
        <img
          ref={imgRef}
          src={holdUrl}
          alt={seq.alt}
          width={px}
          height={px}
          draggable={false}
          className="mascot-seq object-contain select-none w-full h-full"
        />
      </div>
    </div>
  );
}
