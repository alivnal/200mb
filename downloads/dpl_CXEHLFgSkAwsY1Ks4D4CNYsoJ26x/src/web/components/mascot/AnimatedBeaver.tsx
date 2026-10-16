/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef } from 'react';
import PixelBeaverRig, { createPixelBeaverRefs } from './PixelBeaverRig';
import type { BeaverAnimPose } from './pixelBeaverTypes';
import { usePixelBeaverAnimation } from './usePixelBeaverAnimation';

interface AnimatedBeaverProps {
  pose: BeaverAnimPose;
  size?: number;
  progress?: number;
  celebrateLoop?: boolean;
  className?: string;
}

export default function AnimatedBeaver({
  pose,
  size = 80,
  progress = 0,
  celebrateLoop = false,
  className = '',
}: AnimatedBeaverProps) {
  const refs = useMemo(() => createPixelBeaverRefs(), []);
  const scopeRef = useRef<HTMLDivElement>(null);

  usePixelBeaverAnimation(refs, pose, scopeRef, { progress, enabled: true, celebrateLoop });

  return (
    <div ref={scopeRef} className={`inline-flex items-center justify-center ${className}`}>
      <PixelBeaverRig refs={refs} size={size} />
    </div>
  );
}
