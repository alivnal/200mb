/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MascotSeqConfig } from './mascotSvgSequences';

/** One full sprite cycle in seconds (25 frames @ 12fps ≈ 2.08s). */
export function mascotSeqCycleDur(seq: MascotSeqConfig): number {
  return seq.frameCount / seq.fps;
}

export function mascotSeqFrameDur(seq: MascotSeqConfig): number {
  return 1 / seq.fps;
}
