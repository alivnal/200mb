/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';

export default function LandingMascotHero() {
  return (
    <div className="flex justify-center">
      <img
        src="/wave_anim.gif"
        alt="Squik mascot waving with a speech bubble"
        className="h-[8.75rem] sm:h-40 w-auto max-w-full object-contain [image-rendering:pixelated]"
      />
    </div>
  );
}
