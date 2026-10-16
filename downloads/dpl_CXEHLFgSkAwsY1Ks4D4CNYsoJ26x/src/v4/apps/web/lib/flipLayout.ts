/**
 * FLIP-style layout transitions (Flip plugin pattern, core GSAP only).
 */

import { gsap } from '@/lib/gsapSetup';
import { motion } from '@/lib/motion';

export type FlipId = string;

export function captureFlipState(root: ParentNode, selector = '[data-flip-id]'): Map<FlipId, DOMRect> {
  const map = new Map<FlipId, DOMRect>();
  root.querySelectorAll(selector).forEach((node) => {
    const id = node.getAttribute('data-flip-id');
    if (!id) return;
    map.set(id, node.getBoundingClientRect());
  });
  return map;
}

export function flipFromState(
  root: ParentNode | null,
  first: Map<FlipId, DOMRect> | null,
  options?: {
    duration?: number;
    stagger?: number;
    ease?: string;
    selector?: string;
  },
): gsap.core.Timeline | null {
  if (!root || !first || first.size === 0) return null;

  const {
    duration = motion.duration.flip,
    stagger = motion.stagger.flip,
    ease = motion.ease.flip,
    selector = '[data-flip-id]',
  } = options ?? {};

  const tl = gsap.timeline({ defaults: { ease, overwrite: 'auto' } });
  const nodes = [...root.querySelectorAll(selector)] as HTMLElement[];

  nodes.forEach((node, index) => {
    const id = node.getAttribute('data-flip-id');
    if (!id) return;

    const last = node.getBoundingClientRect();
    const start = first.get(id);
    const at = index * stagger;

    if (start) {
      const dx = start.left - last.left;
      const dy = start.top - last.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        tl.fromTo(
          node,
          { x: dx, y: dy },
          { x: 0, y: 0, duration, ease: motion.ease.settle, clearProps: 'transform' },
          at,
        );
        return;
      }
    }

    tl.fromTo(
      node,
      { autoAlpha: 0 },
      {
        autoAlpha: 1,
        duration: motion.duration.flipEnter * 0.7,
        ease: 'power1.out',
      },
      at,
    );
  });

  return tl;
}

export function animateEnter(
  targets: gsap.TweenTarget,
  options?: {
    duration?: number;
    y?: number;
    scale?: number;
    stagger?: number | gsap.StaggerVars;
    ease?: string;
  },
): gsap.core.Tween {
  const {
    duration = motion.duration.screen,
    y = motion.distance.screenY,
    scale = motion.scale.screenFrom,
    stagger = 0,
    ease = motion.ease.enter,
  } = options ?? {};

  return gsap.fromTo(
    targets,
    { autoAlpha: 0, y, scale },
    {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration,
      stagger,
      ease,
      overwrite: 'auto',
      clearProps: 'transform',
    },
  );
}

export function animateExit(
  targets: gsap.TweenTarget,
  options?: { duration?: number; y?: number; onComplete?: () => void },
): gsap.core.Tween {
  const {
    duration = motion.duration.exit,
    y = motion.distance.exitY,
    onComplete,
  } = options ?? {};

  return gsap.to(targets, {
    autoAlpha: 0,
    y,
    scale: 0.99,
    duration,
    ease: motion.ease.exit,
    overwrite: 'auto',
    onComplete,
  });
}
