/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gsap, useGSAP } from '@/lib/gsapSetup';

const INTERACTIVE =
  'a,button,[role="button"],input,select,textarea,label,.pixel-btn,.drop-zone,.titlebar-btn,[tabindex]:not([tabindex="-1"])';

function PixelArrow() {
  return (
    <svg
      className="pixel-cursor-arrow"
      width="14"
      height="20"
      viewBox="0 0 14 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="0" y="0" width="2" height="2" fill="currentColor" />
      <rect x="0" y="2" width="2" height="2" fill="currentColor" />
      <rect x="2" y="2" width="2" height="2" fill="currentColor" />
      <rect x="0" y="4" width="2" height="2" fill="currentColor" />
      <rect x="2" y="4" width="2" height="2" fill="currentColor" />
      <rect x="4" y="4" width="2" height="2" fill="currentColor" />
      <rect x="0" y="6" width="2" height="2" fill="currentColor" />
      <rect x="2" y="6" width="2" height="2" fill="currentColor" />
      <rect x="4" y="6" width="2" height="2" fill="currentColor" />
      <rect x="6" y="6" width="2" height="2" fill="currentColor" />
      <rect x="0" y="8" width="2" height="2" fill="currentColor" />
      <rect x="2" y="8" width="2" height="2" fill="currentColor" />
      <rect x="4" y="8" width="2" height="2" fill="currentColor" />
      <rect x="6" y="8" width="2" height="2" fill="currentColor" />
      <rect x="8" y="8" width="2" height="2" fill="currentColor" />
      <rect x="2" y="10" width="2" height="2" fill="currentColor" />
      <rect x="4" y="10" width="2" height="2" fill="currentColor" />
      <rect x="6" y="10" width="2" height="2" fill="currentColor" />
      <rect x="8" y="10" width="2" height="2" fill="currentColor" />
      <rect x="4" y="12" width="2" height="2" fill="currentColor" />
      <rect x="6" y="12" width="2" height="2" fill="currentColor" />
      <rect x="8" y="12" width="2" height="2" fill="currentColor" />
      <rect x="6" y="14" width="2" height="2" fill="currentColor" />
      <rect x="8" y="14" width="2" height="2" fill="currentColor" />
      <rect x="8" y="16" width="2" height="2" fill="currentColor" />
    </svg>
  );
}

function useFinePointer() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setEnabled(fine.matches);
    update();
    fine.addEventListener('change', update);
    return () => fine.removeEventListener('change', update);
  }, []);

  return enabled;
}

export default function PixelCursor() {
  const enabled = useFinePointer();
  const rootRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle('pixel-cursor-active', enabled);
    return () => document.documentElement.classList.remove('pixel-cursor-active');
  }, [enabled]);

  useGSAP(
    () => {
      if (!enabled) return;

      const pointer = pointerRef.current;
      const trail = trailRef.current;
      const root = rootRef.current;
      if (!pointer || !trail || !root) return;

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const pointerLag = reduceMotion ? 0 : 0.1;
      const trailLag = reduceMotion ? 0 : 0.28;

      gsap.set([pointer, trail], { force3D: true, transformOrigin: '0 0' });
      gsap.set(root, { autoAlpha: 0 });

      const pointerX = gsap.quickTo(pointer, 'x', { duration: pointerLag, ease: 'power3.out' });
      const pointerY = gsap.quickTo(pointer, 'y', { duration: pointerLag, ease: 'power3.out' });
      const trailX = gsap.quickTo(trail, 'x', { duration: trailLag, ease: 'power3.out' });
      const trailY = gsap.quickTo(trail, 'y', { duration: trailLag, ease: 'power3.out' });

      const moveTo = (x: number, y: number) => {
        pointerX(x);
        pointerY(y);
        trailX(x);
        trailY(y);
      };

      const show = () => {
        if (visibleRef.current) return;
        visibleRef.current = true;
        gsap.to(root, { autoAlpha: 1, duration: 0.2, ease: 'power1.out' });
      };

      const hide = () => {
        if (!visibleRef.current) return;
        visibleRef.current = false;
        gsap.to(root, { autoAlpha: 0, duration: 0.15, ease: 'power1.in' });
      };

      const setHover = (active: boolean) => {
        gsap.to(pointer, {
          scale: active ? 1.2 : 1,
          duration: reduceMotion ? 0 : 0.2,
          ease: active ? 'back.out(1.7)' : 'power2.out',
          overwrite: 'auto',
        });
        pointer.classList.toggle('is-hover', active);
      };

      const onMove = (event: MouseEvent) => {
        show();
        moveTo(event.clientX, event.clientY);
      };

      const onLeave = () => hide();

      const onDown = () => {
        gsap.to(pointer, { scale: 0.8, duration: 0.07, ease: 'power2.in', overwrite: 'auto' });
      };

      const onUp = () => {
        const hovered = pointer.classList.contains('is-hover');
        gsap.to(pointer, {
          scale: hovered ? 1.2 : 1,
          duration: reduceMotion ? 0 : 0.28,
          ease: 'back.out(2)',
          overwrite: 'auto',
        });
      };

      const onOver = (event: MouseEvent) => {
        const target = (event.target as Element | null)?.closest(INTERACTIVE);
        setHover(Boolean(target));
      };

      const onOut = (event: MouseEvent) => {
        const to = event.relatedTarget as Element | null;
        if (to?.closest(INTERACTIVE)) return;
        setHover(false);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseleave', onLeave);
      window.addEventListener('mousedown', onDown);
      window.addEventListener('mouseup', onUp);
      document.addEventListener('mouseover', onOver);
      document.addEventListener('mouseout', onOut);

      return () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseleave', onLeave);
        window.removeEventListener('mousedown', onDown);
        window.removeEventListener('mouseup', onUp);
        document.removeEventListener('mouseover', onOver);
        document.removeEventListener('mouseout', onOut);
      };
    },
    { dependencies: [enabled], scope: rootRef },
  );

  if (!enabled) return null;

  return (
    <div ref={rootRef} className="pixel-cursor-root" aria-hidden>
      <div ref={trailRef} className="pixel-cursor-trail">
        <PixelArrow />
      </div>
      <div ref={pointerRef} className="pixel-cursor-pointer">
        <PixelArrow />
      </div>
    </div>
  );
}
