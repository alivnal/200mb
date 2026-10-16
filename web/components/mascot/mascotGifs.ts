/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MascotGifId = 'walky' | 'gym' | 'error' | 'confetti';

const GIF_FILES: Record<MascotGifId, string> = {
  walky: 'walky.gif',
  gym: 'gym.gif',
  error: 'error.gif',
  confetti: 'confetti.gif',
};

export const MASCOT_GIF_ALT: Record<MascotGifId, string> = {
  walky: 'Squik beaver walking',
  gym: 'Squik beaver compressing a video',
  error: 'Squik beaver showing an error',
  confetti: 'Squik beaver celebrating',
};

export function mascotGifSrc(id: MascotGifId): string {
  return `/mascots/${GIF_FILES[id]}`;
}
