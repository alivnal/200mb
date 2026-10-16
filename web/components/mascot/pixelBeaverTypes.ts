/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';

export type BeaverAnimPose =
  | 'greeting'
  | 'sleepy'
  | 'work'
  | 'celebrate'
  | 'error-sad'
  | 'confused'
  | 'base';

export interface PixelBeaverRefs {
  root: React.RefObject<SVGGElement | null>;
  body: React.RefObject<SVGGElement | null>;
  head: React.RefObject<SVGGElement | null>;
  eyesOpen: React.RefObject<SVGGElement | null>;
  eyesClosed: React.RefObject<SVGGElement | null>;
  tail: React.RefObject<SVGGElement | null>;
  leftArm: React.RefObject<SVGGElement | null>;
  rightArm: React.RefObject<SVGGElement | null>;
  legs: React.RefObject<SVGGElement | null>;
  block: React.RefObject<SVGGElement | null>;
  wrench: React.RefObject<SVGGElement | null>;
  file: React.RefObject<SVGGElement | null>;
  errorMark: React.RefObject<SVGGElement | null>;
  questionMark: React.RefObject<SVGGElement | null>;
  zzz: React.RefObject<SVGGElement | null>;
  confetti: React.RefObject<SVGGElement | null>;
}
