/**
 * Shared motion tokens — keep UI + text animation timing/easing in sync.
 */

import { beaverEase } from '@/lib/gsapSetup';

export const motion = {
  ease: {
    enter: beaverEase.squishIn,
    exit: beaverEase.squishOut,
    settle: beaverEase.settle,
    pop: beaverEase.pop,
    flip: 'expo.out',
    flipEnter: 'back.out(1.35)',
    text: 'power3.out',
    pulse: 'sine.inOut',
    emoji: 'back.out(1.7)',
  },
  duration: {
    stepOut: 0.12,
    stepIn: 0.18,
    screen: 0.56,
    section: 0.34,
    flip: 0.5,
    flipEnter: 0.42,
    textChar: 0.48,
    textWord: 0.52,
    emoji: 0.6,
    colorPulse: 1.2,
    dotPulse: 0.52,
    exit: 0.26,
  },
  stagger: {
    textChar: 0.018,
    textWordAmount: 0.3,
    flip: 0.032,
    section: 0.065,
    color: 0.075,
    dot: 0.13,
    emoji: 0.07,
  },
  distance: {
    screenY: 18,
    sectionY: 9,
    textY: 7,
    flipEnterY: 11,
    exitY: -7,
  },
  scale: {
    screenFrom: 0.992,
    flipEnterFrom: 0.965,
    emojiFrom: 0.35,
  },
} as const;
