'use client';

import { useTheme } from '@/app/providers';
import { useStillness } from './iso/react/live';

// Pixel-art hero rendered in Aseprite from art/squik-hero (run build.sh):
// 320x260 native, seamless 120-frame loop, transparent background. Day art
// follows the light theme, night art the dark theme.
const WIDTH = 320;
const HEIGHT = 260;

export default function SquikHero() {
  const still = useStillness();
  const { resolvedTheme } = useTheme();
  const time = resolvedTheme === 'dark' ? 'night' : 'day';

  return (
    // Shares the tool card's grid cell, so the scene stays anchored to the
    // card: the card sits on the diorama's empty front meadow.
    <div className="squik-stage" aria-hidden="true">
      <img
        className="squik-hero"
        src={still ? `/hero/squik-hero-${time}-still.png` : `/hero/squik-hero-${time}.webp`}
        width={WIDTH}
        height={HEIGHT}
        alt=""
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
