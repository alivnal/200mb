/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useRef, type ElementType } from 'react';
import { gsap, useGSAP } from '@/lib/gsapSetup';

const ACCENT_COLORS = ['#5ba3ff', '#0e71fb', '#0b5fd4'];
const INK_COLORS = ['#71717a', '#3f3f46', '#18181b'];

function stripTrailingEllipsis(text: string): { base: string; pulseDots: boolean } {
  if (text.endsWith('…')) {
    return { base: text.slice(0, -1).trimEnd(), pulseDots: true };
  }
  if (text.endsWith('...')) {
    return { base: text.slice(0, -3).trimEnd(), pulseDots: true };
  }
  return { base: text, pulseDots: false };
}

interface AnimatedTextProps {
  text: string;
  as?: ElementType;
  className?: string;
  animateDots?: boolean;
  colorAnimation?: 'accent' | 'ink' | false;
}

export default function AnimatedText({
  text,
  as: Tag = 'p',
  className = '',
  animateDots = true,
  colorAnimation = 'accent',
}: AnimatedTextProps) {
  const scopeRef = useRef<HTMLSpanElement>(null);
  const { base, pulseDots } = stripTrailingEllipsis(text);
  const showDots = animateDots && pulseDots;
  const palette = colorAnimation === 'ink' ? INK_COLORS : ACCENT_COLORS;

  useGSAP(
    () => {
      const root = scopeRef.current;
      if (!root) return;

      const chars = root.querySelectorAll('.anim-text-char');
      gsap.fromTo(
        chars,
        {
          opacity: 0,
          y: 8,
          color: palette[0],
        },
        {
          opacity: 1,
          y: 0,
          color: 'inherit',
          duration: 0.38,
          stagger: 0.02,
          ease: 'power2.out',
        },
      );

      if (colorAnimation) {
        const cycle = gsap.timeline({ repeat: -1 });
        for (const color of palette) {
          cycle.to(chars, {
            color,
            duration: 0.8,
            stagger: 0.07,
            ease: 'power1.inOut',
          });
        }
      }

      const dots = root.querySelectorAll('.anim-text-dot');
      if (dots.length > 0) {
        gsap.fromTo(
          dots,
          { opacity: 0.25, color: palette[0] },
          {
            opacity: 1,
            color: palette[1],
            duration: 0.5,
            stagger: { each: 0.18, repeat: -1, yoyo: true },
            ease: 'power1.inOut',
          },
        );
      }
    },
    { scope: scopeRef, dependencies: [text, colorAnimation], revertOnUpdate: true },
  );

  return (
    <Tag className={className} aria-live="polite">
      <span ref={scopeRef} className="inline">
        {base.split('').map((char, index) => (
          <span key={`${text}-${index}`} className="anim-text-char inline-block">
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
        {showDots && (
          <span aria-hidden className="inline-flex">
            {[0, 1, 2].map((index) => (
              <span key={index} className="anim-text-dot">
                .
              </span>
            ))}
          </span>
        )}
      </span>
    </Tag>
  );
}
