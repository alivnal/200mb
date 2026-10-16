/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { beaverBounce, beaverEase, beaverWiggleSoft, gsap } from '@/lib/gsapSetup';
import type { MascotGifId } from './mascotGifs';

export function buildMascotGifTimeline(
  target: HTMLElement,
  id: MascotGifId,
  options?: { loop?: boolean; intensity?: number },
): gsap.core.Timeline {
  const loop = options?.loop ?? true;
  const intensity = options?.intensity ?? 1;

  const tl = gsap.timeline({
    defaults: { duration: 0.45, ease: 'power2.out' },
    repeat: loop ? -1 : 0,
    repeatDelay: loop ? 0.15 : 0,
  });

  tl.addLabel('intro', 0);
  tl.fromTo(
    target,
    { opacity: 0, scale: 0.88, y: 6 },
    { opacity: 1, scale: 1, y: 0, ease: beaverEase.pop },
    'intro',
  );

  switch (id) {
    case 'walky':
      tl.addLabel('walk', '+=0.05');
      tl.to(target, { y: -4, duration: 0.55, ease: beaverEase.breathe }, 'walk');
      tl.to(target, { x: 3, duration: 0.7, ease: 'sine.inOut' }, 'walk');
      tl.to(target, { y: 0, x: 0, duration: 0.55, ease: beaverEase.settle }, 'walk+=0.55');
      break;

    case 'gym':
      tl.addLabel('strain', '+=0.02');
      tl.to(
        target,
        { scaleY: 0.94, scaleX: 1.04, duration: 0.22 * intensity, ease: beaverEase.squishIn },
        'strain',
      );
      tl.to(
        target,
        { scaleY: 1.02, scaleX: 0.98, duration: 0.18 * intensity, ease: beaverEase.squishOut },
        'strain+=0.22',
      );
      tl.to(target, { scaleY: 1, scaleX: 1, duration: 0.2, ease: beaverEase.settle }, 'strain+=0.4');
      tl.to(target, { rotation: 1.5, duration: 0.35, ease: beaverWiggleSoft }, 'strain');
      tl.to(target, { rotation: -1.5, duration: 0.35, ease: beaverWiggleSoft }, 'strain+=0.35');
      tl.to(target, { rotation: 0, duration: 0.25, ease: 'sine.out' }, 'strain+=0.7');
      break;

    case 'error':
      tl.addLabel('sad', '+=0.05');
      tl.to(target, { y: 2, rotation: -2, duration: 0.9, ease: beaverEase.breathe }, 'sad');
      tl.to(target, { y: 0, rotation: 2, duration: 0.9, ease: beaverEase.breathe }, 'sad+=0.9');
      tl.to(target, { rotation: 0, duration: 0.4, ease: 'sine.out' }, 'sad+=1.8');
      break;

    case 'confetti':
      tl.addLabel('pop', '+=0.02');
      tl.to(target, { y: -8, scale: 1.06, duration: 0.2, ease: beaverEase.pop }, 'pop');
      tl.to(target, { y: 0, scale: 1, duration: 0.5, ease: beaverBounce }, 'pop');
      tl.to(target, { y: -3, duration: 0.5, ease: beaverEase.breathe }, 'pop+=0.55');
      tl.to(target, { y: 0, duration: 0.45, ease: beaverEase.settle }, 'pop+=1.05');
      break;
  }

  return tl;
}
