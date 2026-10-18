'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from '@/app/providers';
import { useStillness } from './iso/react/live';

// Pixel-art hero rendered in Aseprite from art/squik-hero (run build.sh):
// 320x260 native, seamless 120-frame loop, transparent background. Day art
// follows the light theme, night art the dark theme.
const WIDTH = 320;
const HEIGHT = 260;
// Art point where the card's top-left corner goes. Right of and below it is
// only empty meadow and transparent canvas, so the card never covers the
// pond, lodge, dam, waterfall or any beaver, whatever the scale.
const MEADOW_X = 150;
const MEADOW_Y = 118;
const GAP = 8;
const MAX_SCALE = 4;
const SIDE_BY_SIDE = '(min-width: 901px)';

type Fit = { scale: number; left: number; top: number; cardShift: number };

// Largest scale at which the whole scene fits between the header and the
// bottom of the scroll area and inside the window, given the card's column.
// Returns the image offsets relative to the stage and how far to move the
// card vertically so its corner lands on the meadow.
function measureFit(stage: HTMLElement, card: HTMLElement, currentShift: number): Fit {
  const header = document.querySelector('.app-header');
  const scroller = stage.closest('.screen-content');
  const box = card.getBoundingClientRect();
  const anchor = stage.getBoundingClientRect();
  const top = (header?.getBoundingClientRect().bottom ?? 0) + GAP;
  const bottom = (scroller?.getBoundingClientRect().bottom ?? window.innerHeight) - GAP;
  const right = document.documentElement.clientWidth - GAP;
  const fits = Math.min(
    MAX_SCALE,
    (bottom - top) / HEIGHT,
    (box.left - GAP) / MEADOW_X,
    (right - box.left) / (WIDTH - MEADOW_X),
  );
  // Half steps land on whole device pixels on 2x screens, so the art stays crisp.
  const scale = Math.max(1, Math.floor(fits * 2) / 2);
  // Centre the scene, but lift it when a tall card (long clip lists) needs the
  // room below. If even that is not enough, the card runs past the fold and
  // the page scrolls; it never rises over the scene.
  const centred = top + (bottom - top - HEIGHT * scale) / 2;
  const roomForCard = bottom - box.height - MEADOW_Y * scale;
  const imageTop = Math.max(top, Math.min(centred, roomForCard));
  const imageLeft = box.left - MEADOW_X * scale;
  const cardTop = imageTop + MEADOW_Y * scale;
  return {
    scale,
    left: imageLeft - anchor.left,
    top: imageTop - anchor.top,
    cardShift: cardTop - (box.top - currentShift),
  };
}

export default function SquikHero() {
  const still = useStillness();
  const { resolvedTheme } = useTheme();
  const time = resolvedTheme === 'dark' ? 'night' : 'day';
  const stageRef = useRef<HTMLDivElement>(null);
  const shiftRef = useRef(0);
  const [fit, setFit] = useState<Fit | null>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const layout = stage?.parentElement;
    const card = layout?.querySelector<HTMLElement>('.tool-ui');
    if (!stage || !layout || !card) return;
    const sideBySide = window.matchMedia(SIDE_BY_SIDE);

    const measure = () => {
      const next = sideBySide.matches ? measureFit(stage, card, shiftRef.current) : null;
      shiftRef.current = next?.cardShift ?? 0;
      // The card reads this through `translate`, which leaves layout alone and
      // composes with its slide-in animation.
      if (next) layout.style.setProperty('--squik-card-shift', `${next.cardShift}px`);
      else layout.style.removeProperty('--squik-card-shift');
      setFit(next);
    };
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);
    observer.observe(card);
    // The card slides in on load; measure again once it has settled.
    card.addEventListener('animationend', update);
    sideBySide.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      card.removeEventListener('animationend', update);
      sideBySide.removeEventListener('change', update);
      window.removeEventListener('resize', update);
      layout.style.removeProperty('--squik-card-shift');
    };
  }, []);

  return (
    // Side by side, the stage is a zero-size anchor in the card's grid cell;
    // stacked, it is a normal row above the card.
    <div ref={stageRef} className="squik-stage" aria-hidden="true">
      <img
        className="squik-hero"
        src={still ? `/hero/squik-hero-${time}-still.png` : `/hero/squik-hero-${time}.webp`}
        width={WIDTH}
        height={HEIGHT}
        alt=""
        decoding="async"
        draggable={false}
        data-ready={fit ? '' : undefined}
        style={fit ? { width: WIDTH * fit.scale, left: fit.left, top: fit.top } : undefined}
      />
    </div>
  );
}
