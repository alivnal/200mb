/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BeaverPoseName =
  | 'base-front'
  | 'hard-at-work'
  | 'celebrate'
  | 'greeting'
  | 'error-sad'
  | 'confused'
  | 'sleepy';

const POSE_FILES: Record<BeaverPoseName, string> = {
  'base-front': 'beaver-base-front.png',
  'hard-at-work': 'beaver-hard-at-work.png',
  celebrate: 'beaver-celebrate.png',
  greeting: 'beaver-greeting.png',
  'error-sad': 'beaver-error-sad.png',
  confused: 'beaver-confused.png',
  sleepy: 'beaver-sleepy.png',
};

export function beaverPoseSrc(pose: BeaverPoseName): string {
  return `/mascots/${POSE_FILES[pose]}`;
}

export const POSE_ALT: Record<BeaverPoseName, string> = {
  'base-front': 'Squik pixel beaver mascot',
  'hard-at-work': 'Squik beaver working on compression',
  celebrate: 'Squik beaver celebrating successful compression',
  greeting: 'Squik beaver waving hello',
  'error-sad': 'Squik beaver looking sad after an error',
  confused: 'Squik beaver thinking about a problem',
  sleepy: 'Squik beaver resting',
};
