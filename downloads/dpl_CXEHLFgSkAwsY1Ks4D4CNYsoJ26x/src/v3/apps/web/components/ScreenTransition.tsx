/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/gsapSetup';
import { motion } from '@/lib/motion';

interface ScreenTransitionProps {
  screenKey: string;
  children: React.ReactNode;
  className?: string;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function ScreenTransition({ screenKey, children, className = '' }: ScreenTransitionProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isFirstMount = useRef(true);
  const [renderedKey, setRenderedKey] = useState(screenKey);
  const [rendered, setRendered] = useState(children);

  useLayoutEffect(() => {
    const el = contentRef.current;

    // Same step — update content silently (e.g. compression progress ticks).
    if (screenKey === renderedKey) {
      setRendered(children);
      return;
    }

    if (!el || prefersReducedMotion()) {
      setRendered(children);
      setRenderedKey(screenKey);
      isFirstMount.current = false;
      return;
    }

    if (isFirstMount.current) {
      isFirstMount.current = false;
      setRendered(children);
      setRenderedKey(screenKey);
      gsap.fromTo(
        el,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: motion.duration.stepIn, ease: 'power1.out' },
      );
      return;
    }

    gsap.killTweensOf(el);
    gsap.to(el, {
      autoAlpha: 0,
      duration: motion.duration.stepOut,
      ease: 'power1.in',
      onComplete: () => {
        setRendered(children);
        setRenderedKey(screenKey);
        requestAnimationFrame(() => {
          if (!contentRef.current) return;
          gsap.fromTo(
            contentRef.current,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: motion.duration.stepIn, ease: 'power1.out' },
          );
        });
      },
    });
  }, [screenKey, children, renderedKey]);

  return (
    <div className={`screen-content text-ink relative ${className}`}>
      <div ref={contentRef} className="w-full min-h-0 flex flex-col items-center justify-center">
        {rendered}
      </div>
    </div>
  );
}
