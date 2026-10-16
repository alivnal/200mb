/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { beaverBounce, beaverEase, beaverWiggle, beaverWiggleSoft, gsap } from '@/lib/gsapSetup';
import type { BeaverAnimPose, PixelBeaverRefs } from './pixelBeaverTypes';

export type WorkFrame = {
  armY: number;
  bodyY: number;
  bodyScaleY: number;
  tailRotation: number;
  blockScaleY: number;
  wrenchRotation: number;
  hold: number;
};

export const WORK_FRAMES: WorkFrame[] = [
  { armY: 0, bodyY: 0, bodyScaleY: 1, tailRotation: -6, blockScaleY: 1, wrenchRotation: -8, hold: 0.12 },
  { armY: 3, bodyY: 1, bodyScaleY: 0.92, tailRotation: 8, blockScaleY: 0.72, wrenchRotation: 12, hold: 0.08 },
  { armY: 5, bodyY: 2, bodyScaleY: 0.88, tailRotation: -4, blockScaleY: 0.55, wrenchRotation: -6, hold: 0.14 },
  { armY: 2, bodyY: 1, bodyScaleY: 0.94, tailRotation: 10, blockScaleY: 0.78, wrenchRotation: 8, hold: 0.1 },
  { armY: 0, bodyY: 0, bodyScaleY: 1, tailRotation: -8, blockScaleY: 1, wrenchRotation: -10, hold: 0.16 },
];

export const CELEBRATE_CONFETTI = [
  { x: 8, y: 6, w: 3, h: 5, color: 'var(--color-beaver-blue)', rotation: 12 },
  { x: 36, y: 8, w: 4, h: 3, color: 'var(--color-beaver-blue-light)', rotation: -18 },
  { x: 14, y: 4, w: 3, h: 3, color: 'var(--color-success)', rotation: 45 },
  { x: 30, y: 5, w: 2, h: 4, color: 'var(--color-beaver-blue-dark)', rotation: -30 },
] as const;

const CONFETTI_PHYSICS = [
  { velocity: 95, angle: -115, gravity: 160 },
  { velocity: 110, angle: -70, gravity: 140 },
  { velocity: 85, angle: -140, gravity: 180 },
  { velocity: 100, angle: -95, gravity: 150 },
] as const;

function setVisible(el: SVGGElement | null, visible: boolean) {
  if (!el) return;
  gsap.set(el, { opacity: visible ? 1 : 0, pointerEvents: 'none' });
}

export function resetBeaverPose(refs: PixelBeaverRefs) {
  const groups = [
    refs.root.current,
    refs.body.current,
    refs.head.current,
    refs.tail.current,
    refs.leftArm.current,
    refs.rightArm.current,
    refs.block.current,
    refs.wrench.current,
    refs.file.current,
    refs.legs.current,
    refs.errorMark.current,
    refs.questionMark.current,
    refs.zzz.current,
  ].filter(Boolean);

  gsap.set(groups, { clearProps: 'transform,opacity' });
  if (refs.confetti.current) {
    gsap.set(refs.confetti.current, { opacity: 0 });
    gsap.set(refs.confetti.current.querySelectorAll('[data-confetti]'), { clearProps: 'all' });
  }
}

/** Stitch-inspired resting layout per pose before GSAP loops run. */
export function applyPoseLayout(refs: PixelBeaverRefs, pose: BeaverAnimPose) {
  resetBeaverPose(refs);

  setVisible(refs.wrench.current, pose === 'work');
  setVisible(refs.file.current, pose === 'work');
  setVisible(refs.block.current, pose === 'work');
  setVisible(refs.errorMark.current, pose === 'error-sad');
  setVisible(refs.questionMark.current, pose === 'confused');
  setVisible(refs.zzz.current, pose === 'sleepy');
  setVisible(refs.confetti.current, false);

  setVisible(refs.eyesOpen.current, pose !== 'sleepy' && pose !== 'error-sad' && pose !== 'work');
  setVisible(refs.eyesClosed.current, pose === 'sleepy' || pose === 'error-sad' || pose === 'work');

  if (pose === 'greeting') {
    gsap.set(refs.rightArm.current, { rotation: -42, x: -2, y: -6, transformOrigin: '30px 24px' });
  } else if (pose === 'confused') {
    gsap.set(refs.rightArm.current, { rotation: -55, x: 4, y: -8, transformOrigin: '30px 24px' });
    gsap.set(refs.head.current, { rotation: -6, transformOrigin: '30px 16px' });
  } else if (pose === 'celebrate') {
    gsap.set(refs.rightArm.current, { rotation: -68, x: -1, y: -10, transformOrigin: '30px 24px' });
    gsap.set(refs.leftArm.current, { rotation: 68, x: 1, y: -10, transformOrigin: '18px 24px' });
  } else if (pose === 'error-sad') {
    gsap.set(refs.head.current, { y: 2, rotation: 6, transformOrigin: '30px 18px' });
    gsap.set(refs.tail.current, { rotation: -12, transformOrigin: '8px 34px' });
  } else if (pose === 'sleepy') {
    gsap.set(refs.root.current, { y: 3, scale: 0.92, transformOrigin: '24px 30px' });
    gsap.set(refs.head.current, { rotation: 14, y: 2, transformOrigin: '30px 16px' });
    gsap.set(refs.tail.current, { rotation: 28, x: 2, transformOrigin: '8px 34px' });
    gsap.set(refs.legs.current, { opacity: 0.4 });
  } else if (pose === 'work') {
    gsap.set(refs.head.current, { rotation: 8, y: 1, transformOrigin: '30px 16px' });
    gsap.set(refs.body.current, { rotation: 4, transformOrigin: '24px 28px' });
  }
}

function burstConfetti(refs: PixelBeaverRefs, tl: gsap.core.Timeline, at = 0.08) {
  if (!refs.confetti.current) return;

  tl.set(refs.confetti.current, { opacity: 1 }, at);
  const pieces = refs.confetti.current.querySelectorAll<SVGRectElement>('[data-confetti]');

  pieces.forEach((piece, i) => {
    const physics = CONFETTI_PHYSICS[i % CONFETTI_PHYSICS.length];
    gsap.set(piece, { x: 0, y: 0, opacity: 1, rotation: 0 });
    tl.fromTo(
      piece,
      { scale: 0.2, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.12, ease: beaverEase.pop },
      at,
    );
    tl.to(
      piece,
      {
        duration: 0.9,
        physics2D: {
          velocity: physics.velocity,
          angle: physics.angle,
          gravity: physics.gravity,
        },
        rotation: `+=${i === 2 ? 180 : 120}`,
        ease: 'none',
      },
      at + 0.04,
    );
    tl.to(piece, { opacity: 0, duration: 0.25, ease: 'power1.in' }, at + 0.75);
  });

  tl.set(refs.confetti.current, { opacity: 0 }, at + 1.1);
}

export function buildGreetingTimeline(refs: PixelBeaverRefs): gsap.core.Timeline {
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.35 });

  if (refs.rightArm.current) {
    tl.to(refs.rightArm.current, { rotation: -18, duration: 0.22, ease: beaverEase.wave })
      .to(refs.rightArm.current, { rotation: -58, duration: 0.16, ease: 'power2.out' })
      .to(refs.rightArm.current, { rotation: -30, duration: 0.2, ease: beaverEase.settle })
      .to(refs.rightArm.current, { rotation: -42, duration: 0.24, ease: beaverEase.breathe });
  }

  if (refs.head.current) {
    tl.to(refs.head.current, { rotation: -6, duration: 0.5, ease: beaverEase.breathe }, 0)
      .to(refs.head.current, { rotation: 0, duration: 0.5, ease: beaverEase.breathe }, 0.5);
  }

  if (refs.body.current) {
    tl.to(refs.body.current, { y: -1.5, duration: 0.65, ease: beaverEase.breathe, yoyo: true, repeat: 1 }, 0);
  }

  if (refs.tail.current) {
    tl.to(refs.tail.current, { rotation: 8, duration: 0.8, ease: beaverWiggleSoft }, 0);
  }

  return tl;
}

export function buildSleepyTimeline(refs: PixelBeaverRefs): gsap.core.Timeline {
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4 });

  if (refs.body.current) {
    tl.to(refs.body.current, {
      scaleY: 0.95,
      duration: 1.8,
      ease: beaverEase.breathe,
      yoyo: true,
      repeat: 1,
    });
  }

  if (refs.zzz.current) {
    const pieces = refs.zzz.current.querySelectorAll('[data-zzz]');
    tl.fromTo(
      pieces,
      { y: 0, opacity: 0.35, scale: 0.85 },
      {
        y: -8,
        opacity: 1,
        scale: 1,
        duration: 1.4,
        stagger: { each: 0.22, from: 'start' },
        ease: beaverEase.settle,
      },
      0,
    );
    tl.to(pieces, { opacity: 0, duration: 0.35, stagger: 0.1, ease: 'power1.in' }, 1.1);
  }

  if (refs.tail.current) {
    tl.to(refs.tail.current, { rotation: 24, duration: 2.2, ease: beaverEase.breathe, yoyo: true, repeat: 1 }, 0);
  }

  return tl;
}

export function buildWorkTimeline(refs: PixelBeaverRefs, timeScale: number): gsap.core.Timeline {
  const tl = gsap.timeline({ repeat: -1 });
  tl.timeScale(timeScale);

  let t = 0;
  for (let i = 0; i < WORK_FRAMES.length; i++) {
    const frame = WORK_FRAMES[i];
    const isSquish = frame.bodyScaleY < 0.95;
    const ease = isSquish ? beaverEase.squishIn : beaverEase.squishOut;

    if (refs.leftArm.current && refs.rightArm.current) {
      tl.to(refs.leftArm.current, { y: frame.armY, duration: frame.hold, ease }, t);
      tl.to(refs.rightArm.current, { y: frame.armY + 1, duration: frame.hold, ease }, t);
    }
    if (refs.body.current) {
      tl.to(
        refs.body.current,
        { y: frame.bodyY, scaleY: frame.bodyScaleY, duration: frame.hold, ease },
        t,
      );
    }
    if (refs.tail.current) {
      tl.to(refs.tail.current, { rotation: frame.tailRotation, duration: frame.hold * 0.75, ease: beaverEase.settle }, t);
    }
    if (refs.block.current) {
      tl.to(refs.block.current, { scaleY: frame.blockScaleY, duration: frame.hold, ease: beaverEase.squishIn }, t);
    }
    if (refs.wrench.current) {
      tl.to(
        refs.wrench.current,
        { rotation: frame.wrenchRotation, duration: frame.hold * 0.6, ease: isSquish ? beaverWiggle : beaverEase.settle },
        t,
      );
    }
    if (refs.file.current) {
      tl.to(refs.file.current, { y: frame.armY * 0.5, duration: frame.hold, ease: beaverEase.settle }, t);
    }
    if (isSquish && refs.root.current) {
      tl.to(refs.root.current, { x: 0.5, duration: frame.hold * 0.4, ease: beaverWiggleSoft }, t);
    }
    t += frame.hold;
  }

  return tl;
}

export function buildCelebrateTimeline(refs: PixelBeaverRefs, loop = false): gsap.core.Timeline {
  const tl = gsap.timeline({ repeat: loop ? -1 : 0, repeatDelay: loop ? 1.4 : 0 });

  if (refs.root.current) {
    tl.to(refs.root.current, { y: -9, scaleY: 1.04, duration: 0.2, ease: 'power2.out' })
      .to(refs.root.current, { y: 0, scaleY: 1, duration: 0.55, ease: beaverBounce });
  }

  if (refs.leftArm.current && refs.rightArm.current) {
    tl.to(refs.leftArm.current, { rotation: 82, y: -14, duration: 0.18, ease: beaverEase.pop }, 0)
      .to(refs.rightArm.current, { rotation: -82, y: -14, duration: 0.18, ease: beaverEase.pop }, 0)
      .to(refs.leftArm.current, { rotation: 60, y: -7, duration: 0.4, ease: beaverEase.settle }, 0.32)
      .to(refs.rightArm.current, { rotation: -60, y: -7, duration: 0.4, ease: beaverEase.settle }, 0.32);
  }

  if (refs.tail.current) {
    tl.to(refs.tail.current, { rotation: 18, duration: 0.16, ease: 'power2.out' }, 0)
      .to(refs.tail.current, { rotation: -4, duration: 0.3, ease: beaverWiggleSoft }, 0.2);
  }

  burstConfetti(refs, tl, 0.08);

  return tl;
}

export function buildErrorTimeline(refs: PixelBeaverRefs): gsap.core.Timeline {
  const tl = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.2 });

  if (refs.head.current) {
    tl.to(refs.head.current, { y: 3.5, rotation: 9, duration: 1.5, ease: beaverEase.breathe }, 0);
  }
  if (refs.body.current) {
    tl.to(refs.body.current, { scaleY: 0.96, duration: 1.7, ease: beaverEase.breathe }, 0);
  }
  if (refs.errorMark.current) {
    tl.to(refs.errorMark.current, { y: -3, duration: 0.7, ease: beaverWiggle }, 0);
  }

  return tl;
}

export function buildConfusedTimeline(refs: PixelBeaverRefs): gsap.core.Timeline {
  const tl = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.15 });

  if (refs.head.current) {
    tl.to(refs.head.current, { rotation: -12, duration: 1.2, ease: beaverEase.settle }, 0);
  }
  if (refs.rightArm.current) {
    tl.to(refs.rightArm.current, { rotation: -46, y: -8, duration: 1, ease: beaverEase.breathe }, 0);
  }
  if (refs.questionMark.current) {
    tl.to(refs.questionMark.current, { y: -4, rotation: 6, duration: 0.85, ease: beaverWiggleSoft }, 0);
  }

  return tl;
}

export function buildTimelineForPose(
  refs: PixelBeaverRefs,
  pose: BeaverAnimPose,
  progress = 0,
  celebrateLoop = false,
): gsap.core.Timeline | null {
  applyPoseLayout(refs, pose);

  switch (pose) {
    case 'greeting':
    case 'base':
      return buildGreetingTimeline(refs);
    case 'sleepy':
      return buildSleepyTimeline(refs);
    case 'work':
      return buildWorkTimeline(refs, 0.85 + progress * 0.55);
    case 'celebrate':
      return buildCelebrateTimeline(refs, celebrateLoop);
    case 'error-sad':
      return buildErrorTimeline(refs);
    case 'confused':
      return buildConfusedTimeline(refs);
    default:
      return null;
  }
}
