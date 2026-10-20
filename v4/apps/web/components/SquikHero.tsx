'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
// Stacked, a scene shorter than this is left out, so a tall card (trim with a
// video loaded) gets the whole first screen. Matches the CSS minimum width.
const MIN_STACKED_HEIGHT = 80;
const TIMES = ['day', 'night'] as const;
type Time = (typeof TIMES)[number];

/** Which diorama: the homepage hero, or the scene for a running job. */
export type DioramaScene = 'hero' | 'compress' | 'merge' | 'trim';

const sceneSrc = (scene: DioramaScene, time: Time, still: boolean) =>
  still ? `/hero/squik-${scene}-${time}-still.png` : `/hero/squik-${scene}-${time}.webp`;

type Fit = { scale: number; left: number; top: number; cardShift: number };

// The scale the scene takes for the largest scale that fits. On 2x and 3x
// screens it steps down to whole device pixels per art pixel, so the pixel art
// stays crisp. Elsewhere crisp steps are too coarse (whole scales at 100%) or
// fall between the sizes that fit (125%, 150%), so the scene takes all the
// room it has. Never below 0.5x.
function snapScale(scale: number): number {
  const ratio = window.devicePixelRatio || 1;
  const crisp = Number.isInteger(ratio) && ratio >= 2 ? Math.floor(scale * ratio) / ratio : scale;
  return Math.max(0.5, crisp);
}

// The bottom of the first screen, in viewport coordinates: the page can be
// taller than the window (short laptop screens), and everything placed here
// must be visible without scrolling.
function firstScreenBottom(): number {
  const page = document.documentElement;
  return page.getBoundingClientRect().top + page.clientHeight;
}

// Places the whole scene between the header and the bottom of the first
// screen, never under the card, and the whole card on screen.
// Two layouts compete and the one showing the scene larger wins:
// - meadow: the card's corner sits on the empty front meadow (short cards);
// - beside: the scene sits entirely left of the card (tall cards: trim,
//   long clip lists), with the card centred vertically.
// Returns image offsets relative to the stage and the card's vertical move.
function measureFit(stage: HTMLElement, card: HTMLElement, currentShift: number): Fit {
  const header = document.querySelector('.app-header');
  const scroller = stage.closest('.screen-content');
  const box = card.getBoundingClientRect();
  // On first paint the card's slide-in still holds it lower; measured with
  // that offset, the card would jump once the animation ends.
  const transform = getComputedStyle(card).transform;
  const slide = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : 0;
  const anchor = stage.getBoundingClientRect();
  const top = (header?.getBoundingClientRect().bottom ?? 0) + GAP;
  const bottom = Math.min(scroller?.getBoundingClientRect().bottom ?? Infinity, firstScreenBottom()) - GAP;
  const right = document.documentElement.clientWidth - GAP;
  const room = bottom - top;

  const meadow = snapScale(Math.min(
    MAX_SCALE,
    room / HEIGHT,
    (room - box.height) / MEADOW_Y,
    (box.left - GAP) / MEADOW_X,
    (right - box.left) / (WIDTH - MEADOW_X),
  ));
  const beside = snapScale(Math.min(MAX_SCALE, room / HEIGHT, (box.left - 2 * GAP) / WIDTH));
  // snapScale never goes below 0.5x, so a short window can leave the meadow
  // layout too tall for the room; then the scene goes beside the card if it fits there.
  const meadowFits = HEIGHT * meadow <= room && MEADOW_Y * meadow + box.height <= room;
  const besideFits = HEIGHT * beside <= room && WIDTH * beside <= box.left - 2 * GAP;

  let scale: number;
  let imageLeft: number;
  let imageTop: number;
  let cardTop: number;
  if (meadowFits ? meadow >= beside || !besideFits : !besideFits) {
    scale = meadow;
    imageLeft = box.left - MEADOW_X * scale;
    // Centre scene and card together.
    imageTop = top + (room - Math.max(HEIGHT * scale, MEADOW_Y * scale + box.height)) / 2;
    cardTop = imageTop + MEADOW_Y * scale;
  } else {
    scale = beside;
    imageLeft = GAP + (box.left - 2 * GAP - WIDTH * scale) / 2;
    imageTop = top + (room - HEIGHT * scale) / 2;
    cardTop = top + Math.max(0, (room - box.height) / 2);
  }
  return {
    scale,
    left: imageLeft - anchor.left,
    top: imageTop - anchor.top,
    cardShift: cardTop - (box.top - slide - currentShift),
  };
}

// Stacked, the scene is in flow above the card. CSS sizes it to what the first
// screen has left (100svh, so mobile browser bars never cover the card) after
// this much: the page above the stage, the row gap, the card, a gap, and
// whatever sits below the scroll area on screen (the footer of the desktop
// app, whose window never scrolls).
function stackedReserved(stage: HTMLElement, card: HTMLElement, layout: HTMLElement): number {
  const page = document.documentElement;
  const stageTop = stage.getBoundingClientRect().top - page.getBoundingClientRect().top;
  const rowGap = parseFloat(getComputedStyle(layout).rowGap) || 0;
  const scroller = stage.closest('.screen-content');
  const below = scroller ? Math.max(0, page.clientHeight - scroller.getBoundingClientRect().bottom) : 0;
  return Math.ceil(stageTop + rowGap + card.getBoundingClientRect().height + 2 * GAP + below);
}

// Placed next to the layout's card: the tool card on the homepage, or the
// panel of a running job (.scene-card), which shows the job's own scene.
export default function SquikHero({ scene = 'hero' }: { scene?: DioramaScene }) {
  const still = useStillness();
  const { resolvedTheme } = useTheme();
  const time = resolvedTheme === 'dark' ? 'night' : 'day';
  const stageRef = useRef<HTMLDivElement>(null);
  const shiftRef = useRef(0);
  const [fit, setFit] = useState<Fit | null>(null);
  const [animate, setAnimate] = useState(false);
  const [loadBoth, setLoadBoth] = useState(false);
  // The scene fades in once its image has loaded, rather than appearing as an
  // empty box that fills in a moment later.
  const [revealed, setRevealed] = useState(false);
  const reveal = useCallback(() => setRevealed(true), []);

  // An image the browser had cached (or that loaded before hydration) fires
  // no load event React can see, so check once it is in the page.
  useLayoutEffect(() => {
    const active = stageRef.current?.querySelector<HTMLImageElement>('.squik-scene[data-active]');
    if (active?.complete && active.naturalWidth > 0) reveal();
  }, [scene, time, still, reveal]);

  // The theme settles just after hydration; only animate changes after that,
  // so a night visit does not open with a sunset. The scene not on show is
  // fetched then too, ready for the first switch.
  useEffect(() => {
    const settle = window.setTimeout(() => {
      setAnimate(true);
      setLoadBoth(true);
    }, 1000);
    return () => window.clearTimeout(settle);
  }, []);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const layout = stage?.parentElement;
    const card = layout?.querySelector<HTMLElement>('.tool-ui, .scene-card');
    if (!stage || !layout || !card) return;
    // The stylesheet decides the layout: side by side it takes the scene out of
    // flow for this script to place; stacked (narrow pages, never the desktop
    // app) it leaves the scene in flow above the card.
    const hero = stage.querySelector<HTMLElement>('.squik-hero');
    const sideBySide = () => !hero || getComputedStyle(hero).position === 'absolute';

    const measure = () => {
      const next = sideBySide() ? measureFit(stage, card, shiftRef.current) : null;
      shiftRef.current = next?.cardShift ?? 0;
      // The card reads this through `translate`, which leaves layout alone and
      // composes with its slide-in animation.
      if (next) layout.style.setProperty('--squik-card-shift', `${next.cardShift}px`);
      else layout.style.removeProperty('--squik-card-shift');
      if (next) {
        layout.style.removeProperty('--squik-stack-reserved');
        stage.removeAttribute('data-tight');
      } else {
        const reserved = stackedReserved(stage, card, layout);
        layout.style.setProperty('--squik-stack-reserved', `${reserved}px`);
        // The page's client height is the small viewport, as 100svh is.
        stage.toggleAttribute('data-tight', document.documentElement.clientHeight - reserved < MIN_STACKED_HEIGHT);
      }
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
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      card.removeEventListener('animationend', update);
      window.removeEventListener('resize', update);
      layout.style.removeProperty('--squik-card-shift');
      layout.style.removeProperty('--squik-stack-reserved');
    };
  }, []);

  return (
    // Side by side, the stage is a zero-size anchor in the card's grid cell;
    // stacked, it is a normal row above the card.
    <div ref={stageRef} className="squik-stage" aria-hidden="true">
      <div
        className="squik-hero"
        data-time={time}
        data-ready={fit ? '' : undefined}
        data-animate={animate ? '' : undefined}
        data-revealed={revealed ? '' : undefined}
        style={fit ? { width: WIDTH * fit.scale, left: fit.left, top: fit.top } : undefined}
      >
        {/* Sun and moon sit behind both scenes, so they set and rise behind
            the diorama when the theme changes. */}
        <img className="squik-sky squik-sun" src="/hero/squik-sun.png" alt="" draggable={false} />
        <img className="squik-sky squik-moon" src="/hero/squik-moon.png" alt="" draggable={false} />
        {TIMES.map((variant) => (
          <img
            key={variant}
            className="squik-scene"
            data-active={variant === time ? '' : undefined}
            // The scene not on show loads once the page has settled.
            src={variant === time || loadBoth ? sceneSrc(scene, variant, still) : undefined}
            width={WIDTH}
            height={HEIGHT}
            alt=""
            decoding="async"
            draggable={false}
            onLoad={variant === time ? reveal : undefined}
          />
        ))}
      </div>
    </div>
  );
}
