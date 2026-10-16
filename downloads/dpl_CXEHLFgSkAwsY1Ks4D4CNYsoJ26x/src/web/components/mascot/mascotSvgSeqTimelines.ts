/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { beaverEase, gsap } from '@/lib/gsapSetup';
import { mascotSeqCycleDur } from './mascotSeqCycle';
import type { MascotSeqConfig, PanelMascotVariant } from './mascotSvgSequences';

export function buildFrameSequenceTimeline(
  img: HTMLImageElement,
  frameUrls: string[],
  seq: MascotSeqConfig,
  options?: { loop?: boolean },
): gsap.core.Timeline {
  const loop = options?.loop ?? true;
  const frameCount = frameUrls.length;
  const frameDur = 1 / seq.fps;

  if (frameCount === 0) return gsap.timeline();

  let currentFrame = -1;
  const show = (index: number) => {
    const idx = ((index % frameCount) + frameCount) % frameCount;
    if (idx === currentFrame) return;
    currentFrame = idx;
    img.src = frameUrls[idx];
  };

  const tl = gsap.timeline({
    repeat: loop ? -1 : 0,
    onRepeat: () => {
      currentFrame = -1;
      show(0);
    },
  });

  for (let i = 0; i < frameCount; i++) {
    const frame = i;
    tl.call(() => show(frame)).to({}, { duration: frameDur });
  }

  return tl;
}

function addAmbientLoop(
  tl: gsap.core.Timeline,
  target: HTMLElement,
  variant: PanelMascotVariant,
  cycleDur: number,
): void {
  const half = cycleDur * 0.5;

  tl.addLabel('ambient', 0);

  switch (variant) {
    case 'walky':
      tl.to(target, { y: -2, duration: half, ease: 'sine.inOut' }, 'ambient');
      tl.to(target, { y: 0, duration: half, ease: 'sine.inOut' });
      break;

    case 'gym':
      tl.to(
        target,
        { scaleY: 0.99, scaleX: 1.01, duration: half, ease: beaverEase.squishIn },
        'ambient',
      );
      tl.to(target, { scaleY: 1, scaleX: 1, duration: half, ease: beaverEase.settle });
      break;

    case 'error':
      tl.to(target, { y: 1, rotation: -1, duration: half, ease: 'sine.inOut' }, 'ambient');
      tl.to(target, { y: 0, rotation: 0, duration: half, ease: 'sine.inOut' });
      break;

    case 'confetti':
      tl.to(target, { y: -3, duration: half, ease: 'sine.inOut' }, 'ambient');
      tl.to(target, { y: 0, duration: half, ease: 'sine.inOut' });
      break;
  }
}

export function buildMascotWrapperTimeline(
  target: HTMLElement,
  variant: PanelMascotVariant,
  seq: MascotSeqConfig,
  options?: { loop?: boolean; intro?: boolean },
): gsap.core.Timeline {
  const loop = options?.loop ?? true;
  const intro = options?.intro ?? true;
  const cycleDur = mascotSeqCycleDur(seq);

  const tl = gsap.timeline();

  if (intro) {
    tl.fromTo(
      target,
      { scale: 0.92, y: 4 },
      { scale: 1, y: 0, duration: 0.4, ease: beaverEase.pop },
    );
  } else {
    gsap.set(target, { scale: 1, y: 0, rotation: 0 });
  }

  if (!loop) return tl;

  const loopTl = gsap.timeline({ repeat: -1 });
  addAmbientLoop(loopTl, target, variant, cycleDur);
  tl.add(loopTl);

  return tl;
}
