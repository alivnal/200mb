/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { CustomBounce } from 'gsap/CustomBounce';
import { CustomWiggle } from 'gsap/CustomWiggle';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';

const isClient = typeof window !== 'undefined';

if (isClient) {
  gsap.registerPlugin(useGSAP, CustomEase, CustomBounce, CustomWiggle, Physics2DPlugin);
}

const noopEase = 'none';

export const beaverEase = isClient
  ? {
      wave: CustomEase.create('beaverWave', 'M0,0 C0.35,0.05 0.2,0.95 1,1'),
      breathe: CustomEase.create('beaverBreathe', 'M0,0 C0.45,0 0.55,1 1,1'),
      squishIn: CustomEase.create('beaverSquishIn', 'M0,0 C0.7,0 0.85,0.45 1,1'),
      squishOut: CustomEase.create('beaverSquishOut', 'M0,0 C0.15,0.55 0.3,1 1,1'),
      settle: CustomEase.create('beaverSettle', 'M0,0 C0.25,0.1 0.25,1 1,1'),
      pop: CustomEase.create('beaverPop', 'M0,0 C0.18,0.9 0.25,1 1,1'),
    }
  : {
      wave: noopEase,
      breathe: noopEase,
      squishIn: noopEase,
      squishOut: noopEase,
      settle: noopEase,
      pop: noopEase,
    };

export const beaverBounce = isClient
  ? CustomBounce.create('beaverBounce', {
      strength: 0.72,
      endAtStart: false,
      squash: 1.15,
      squashID: 'beaverSquash',
    })
  : noopEase;

export const beaverWiggle = isClient
  ? CustomWiggle.create('beaverWiggle', {
      wiggles: 9,
      type: 'easeOut',
    })
  : noopEase;

export const beaverWiggleSoft = isClient
  ? CustomWiggle.create('beaverWiggleSoft', {
      wiggles: 5,
      type: 'uniform',
    })
  : noopEase;

export { gsap, useGSAP };
