/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MascotSeqId = 'wave' | 'gym' | 'sleep';

export interface MascotSeqConfig {
  id: MascotSeqId;
  folder: string;
  prefix: string;
  frameCount: number;
  fps: number;
  alt: string;
}

export const MASCOT_SEQUENCES: Record<MascotSeqId, MascotSeqConfig> = {
  wave: {
    id: 'wave',
    folder: 'wave',
    prefix: 'a9d7298a-b887-4d0c-a7b6-76b5932299ca',
    frameCount: 25,
    fps: 12,
    alt: 'Squik beaver waving hello',
  },
  gym: {
    id: 'gym',
    folder: 'gym',
    prefix: '608c7462-9c8f-4fc1-8b71-ad3773f8ba73',
    frameCount: 25,
    fps: 12,
    alt: 'Squik beaver compressing a video',
  },
  sleep: {
    id: 'sleep',
    folder: 'sleep',
    prefix: 'e2980622-70aa-4b1e-a0a8-3e08c99eb958',
    frameCount: 25,
    fps: 12,
    alt: 'Squik beaver resting after success',
  },
};

export type PanelMascotVariant = 'walky' | 'gym' | 'error' | 'confetti';

export const VARIANT_SEQUENCE: Record<PanelMascotVariant, MascotSeqId> = {
  walky: 'wave',
  gym: 'gym',
  error: 'wave',
  confetti: 'sleep',
};

function publicBaseUrl(): string {
  return '/';
}

export function mascotSeqFrameSrc(seq: MascotSeqConfig, frame: number): string {
  return `${publicBaseUrl()}${seq.folder}/${seq.prefix}-${frame}.svg`;
}

export function mascotSeqFrameUrls(seq: MascotSeqConfig): string[] {
  return Array.from({ length: seq.frameCount }, (_, i) => mascotSeqFrameSrc(seq, i + 1));
}
