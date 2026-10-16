/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsapSetup';

// ─── 5×7 pixel font bitmaps ───────────────────────────────────────────────
// 1 = filled pixel, 0 = empty.  Row 0 = top.
const GLYPHS: Record<string, number[][]> = {
  S: [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  Q: [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 1, 0],
    [0, 1, 1, 0, 1],
  ],
  U: [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  I: [
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
  ],
  K: [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 1, 0],
    [1, 0, 1, 0, 0],
    [1, 1, 0, 0, 0],
    [1, 0, 1, 0, 0],
    [1, 0, 0, 1, 0],
    [1, 0, 0, 0, 1],
  ],
};

const BOLT: number[][] = [
  [0, 0, 1, 1, 0],
  [0, 1, 1, 0, 0],
  [1, 1, 1, 1, 0],
  [0, 0, 1, 0, 0],
  [0, 1, 1, 1, 1],
  [0, 1, 1, 0, 0],
  [0, 1, 0, 0, 0],
];

const WORD = ['S', 'Q', 'U', 'I', 'K'];
const PIXEL = 8;   // px per grid cell
const GAP = 3;     // px between letters
const ROWS = 7;
const COLS = 5;

const LETTER_W = COLS * PIXEL;
const LETTER_H = ROWS * PIXEL;
const TOTAL_W = WORD.length * (LETTER_W + GAP) + (LETTER_W + GAP); // +bolt
const TOTAL_H = LETTER_H;

// accent blue — matches --color-accent CSS var
const ACCENT = 'var(--color-accent, #0e71fb)';
const INK = 'currentColor';

interface SquikLogoProps {
  className?: string;
  /** Scale multiplier (1 = default 56 px tall) */
  scale?: number;
  /** Play the entrance animation */
  animate?: boolean;
}

export default function SquikLogo({ className = '', scale = 1, animate = true }: SquikLogoProps) {
  const scopeRef = useRef<SVGSVGElement>(null);

  const W = Math.round(TOTAL_W * scale);
  const H = Math.round(TOTAL_H * scale);

  useGSAP(
    () => {
      if (!animate) return;

      // Each letter's pixel group fades + drops in with stagger
      const letterGroups = scopeRef.current?.querySelectorAll('.sq-letter');
      const boltGroup = scopeRef.current?.querySelector('.sq-bolt');

      if (!letterGroups?.length || !boltGroup) return;

      gsap.set(letterGroups, { opacity: 0, y: -6 });
      gsap.set(boltGroup, { opacity: 0, scale: 0.5, transformOrigin: '50% 50%' });

      gsap.to(letterGroups, {
        opacity: 1,
        y: 0,
        duration: 0.35,
        stagger: 0.07,
        ease: 'back.out(1.4)',
      });

      gsap.to(boltGroup, {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        delay: WORD.length * 0.07 + 0.15,
        ease: 'back.out(2)',
      });
    },
    { scope: scopeRef, dependencies: [animate] },
  );

  return (
    <svg
      ref={scopeRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
      width={W}
      height={H}
      fill="none"
      aria-label="Squik"
      role="img"
      className={className}
      style={{ imageRendering: 'pixelated' }}
    >
      {WORD.map((letter, li) => {
        const glyph = GLYPHS[letter];
        const offsetX = li * (LETTER_W + GAP);
        return (
          <g key={letter + li} className="sq-letter">
            {glyph.map((row, ri) =>
              row.map((on, ci) =>
                on ? (
                  <rect
                    key={`${ri}-${ci}`}
                    x={offsetX + ci * PIXEL}
                    y={ri * PIXEL}
                    width={PIXEL}
                    height={PIXEL}
                    fill={INK}
                    shapeRendering="crispEdges"
                  />
                ) : null,
              ),
            )}
          </g>
        );
      })}

      {/* ⚡ Lightning bolt — accent colour */}
      <g
        className="sq-bolt"
        transform={`translate(${WORD.length * (LETTER_W + GAP)}, 0)`}
      >
        {BOLT.map((row, ri) =>
          row.map((on, ci) =>
            on ? (
              <rect
                key={`b-${ri}-${ci}`}
                x={ci * PIXEL}
                y={ri * PIXEL}
                width={PIXEL}
                height={PIXEL}
                fill={ACCENT}
                shapeRendering="crispEdges"
              />
            ) : null,
          ),
        )}
      </g>
    </svg>
  );
}
