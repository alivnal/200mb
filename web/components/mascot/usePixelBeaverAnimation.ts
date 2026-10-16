/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type RefObject, useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsapSetup';
import type { BeaverAnimPose, PixelBeaverRefs } from './pixelBeaverTypes';
import { buildTimelineForPose, resetBeaverPose } from './poseAnimations';

export function getCompressionPose(progress: number): BeaverAnimPose {
  if (progress >= 1) return 'celebrate';
  if (progress > 0) return 'work';
  return 'sleepy';
}

export function usePixelBeaverAnimation(
  refs: PixelBeaverRefs,
  pose: BeaverAnimPose,
  scopeRef: RefObject<HTMLElement | null>,
  options?: { progress?: number; enabled?: boolean; celebrateLoop?: boolean },
) {
  const activeTimeline = useRef<gsap.core.Timeline | null>(null);
  const poseRef = useRef<BeaverAnimPose | null>(null);
  const progress = options?.progress ?? 0;
  const enabled = options?.enabled ?? true;
  const celebrateLoop = options?.celebrateLoop ?? false;

  useGSAP(
    () => {
      if (!enabled) {
        activeTimeline.current?.kill();
        activeTimeline.current = null;
        poseRef.current = null;
        resetBeaverPose(refs);
        return;
      }

      if (poseRef.current === pose && activeTimeline.current?.isActive()) {
        if (pose === 'work') {
          activeTimeline.current.timeScale(0.85 + progress * 0.55);
        }
        return;
      }

      activeTimeline.current?.kill();
      poseRef.current = pose;
      activeTimeline.current = buildTimelineForPose(refs, pose, progress, celebrateLoop);
    },
    {
      dependencies: [pose, progress, enabled, celebrateLoop],
      scope: scopeRef,
      revertOnUpdate: true,
    },
  );

  return { pose };
}
