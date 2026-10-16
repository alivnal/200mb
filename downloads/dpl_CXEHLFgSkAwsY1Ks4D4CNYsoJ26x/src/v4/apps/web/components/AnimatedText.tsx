/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useRef, type ElementType, type ReactNode } from 'react';
import { gsap, useGSAP } from '@/lib/gsapSetup';
import { motion } from '@/lib/motion';
import {
  reactNodeToText,
  splitPlainText,
  splitReactContent,
  type SplitToken,
  type SplitUnit,
} from '@/lib/textSplit';

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
  /** Plain string (emoji-safe when split is chars/words) */
  text?: string;
  /** Nested inline markup + emoji, SplitText-style */
  children?: ReactNode;
  as?: ElementType;
  className?: string;
  split?: SplitUnit;
  animateDots?: boolean;
  /** Staggered entrance — off for in-flow step screens */
  entrance?: boolean;
}

function renderToken(token: SplitToken, index: number, split: SplitUnit) {
  const isWord = split === 'words' && !token.isSpace;
  const className = [
    'anim-text-unit inline-block',
    token.isEmoji ? 'anim-text-emoji' : '',
    token.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (isWord) {
    return (
      <span key={index} className={className} aria-hidden={token.isSpace}>
        {token.value}
      </span>
    );
  }

  if (token.isSpace) {
    return (
      <span key={index} className="anim-text-space" aria-hidden>
        {token.value === ' ' ? '\u00A0' : token.value}
      </span>
    );
  }

  return (
    <span key={index} className={className} aria-hidden={false}>
      {token.value}
    </span>
  );
}

export default function AnimatedText({
  text,
  children,
  as: Tag = 'p',
  className = '',
  split = 'chars',
  animateDots = true,
  entrance = true,
}: AnimatedTextProps) {
  const scopeRef = useRef<HTMLSpanElement>(null);
  const plain = text ?? reactNodeToText(children);
  const { base, pulseDots } = stripTrailingEllipsis(plain);
  const showDots = animateDots && pulseDots;

  const tokens =
    children != null && text == null
      ? splitReactContent(children, split)
      : splitPlainText(base, split);

  useGSAP(
    () => {
      if (!entrance) return;
      const root = scopeRef.current;
      if (!root) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(root.querySelectorAll('.anim-text-unit, .anim-text-dot'), {
          opacity: 1,
          y: 0,
          scale: 1,
          clearProps: 'transform',
        });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const units = root.querySelectorAll('.anim-text-unit:not(.anim-text-emoji)');
        const emojis = root.querySelectorAll('.anim-text-emoji');
        const isWords = split === 'words';

        const tl = gsap.timeline({ defaults: { ease: motion.ease.text, overwrite: 'auto' } });

        // One-time reveal — no color cycling, text stays readable after entrance.
        tl.fromTo(
          units,
          { autoAlpha: 0, y: motion.distance.textY },
          {
            autoAlpha: 1,
            y: 0,
            duration: isWords ? motion.duration.textWord : motion.duration.textChar,
            stagger: isWords
              ? { amount: motion.stagger.textWordAmount, from: 'start' }
              : motion.stagger.textChar,
          },
        );

        if (emojis.length > 0) {
          tl.fromTo(
            emojis,
            { scale: motion.scale.emojiFrom, autoAlpha: 0 },
            {
              autoAlpha: 1,
              scale: 1,
              duration: motion.duration.emoji,
              stagger: motion.stagger.emoji,
              ease: motion.ease.emoji,
            },
            '-=0.18',
          );
        }

        const dots = root.querySelectorAll('.anim-text-dot');
        if (dots.length > 0) {
          tl.fromTo(
            dots,
            { opacity: 0.35 },
            {
              opacity: 1,
              duration: motion.duration.dotPulse,
              stagger: { each: motion.stagger.dot, repeat: -1, yoyo: true },
              ease: motion.ease.pulse,
            },
            0,
          );
        }
      });

      return () => mm.revert();
    },
    { scope: scopeRef, dependencies: [split, entrance], revertOnUpdate: false },
  );

  if (!entrance) {
    return (
      <Tag className={className} aria-live="polite">
        {children ?? text}
      </Tag>
    );
  }

  return (
    <Tag className={className} aria-live="polite">
      <span ref={scopeRef} className="inline">
        {tokens.map((token, index) => renderToken(token, index, split))}
        {showDots && (
          <span aria-hidden className="inline-flex">
            {[0, 1, 2].map((index) => (
              <span key={index} className="anim-text-dot inline-block">
                .
              </span>
            ))}
          </span>
        )}
      </span>
    </Tag>
  );
}
