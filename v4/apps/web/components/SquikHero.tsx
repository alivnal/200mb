'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from '@/app/providers';
import { useStillness } from './iso/react/live';

// Pixel-art hero rendered in Aseprite from art/squik-hero (run build.sh):
// 320x260 native, seamless 120-frame loop, transparent background. Day art
// follows the light theme, night art the dark theme.
const WIDTH = 320;
const HEIGHT = 260;
// Art column under the card's left edge: the start of the empty front meadow.
const MEADOW_X = 150;
const GAP = 8;
const MAX_SCALE = 4;
const SIDE_BY_SIDE = '(min-width: 901px)';

type Fit = { scale: number; left: number; top: number };

// Largest scale at which the whole scene fits between the header and the
// bottom of the scroll area and inside the window, with the card's left edge
// on the meadow. Offsets are relative to the stage at the card's bottom-left.
function measureFit(stage: HTMLElement): Fit | null {
  const card = stage.parentElement?.querySelector<HTMLElement>('.tool-ui');
  if (!card) return null;
  const header = document.querySelector('.app-header');
  const scroller = stage.closest('.screen-content');
  const box = card.getBoundingClientRect();
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
  return { scale, left: -MEADOW_X * scale, top: bottom - HEIGHT * scale - box.bottom };
}

export default function SquikHero() {
  const still = useStillness();
  const { resolvedTheme } = useTheme();
  const time = resolvedTheme === 'dark' ? 'night' : 'day';
  const stageRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit | null>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const sideBySide = window.matchMedia(SIDE_BY_SIDE);
    const card = stage.parentElement?.querySelector('.tool-ui');
    const measure = () => setFit(sideBySide.matches ? measureFit(stage) : null);
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);
    if (card) observer.observe(card);
    // The card slides in on load; measure again once it has settled.
    card?.addEventListener('animationend', update);
    sideBySide.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      card?.removeEventListener('animationend', update);
      sideBySide.removeEventListener('change', update);
      window.removeEventListener('resize', update);
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
