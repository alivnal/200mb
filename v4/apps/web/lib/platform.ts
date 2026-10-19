/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const ENCODER_LABEL = 'Browser (WebAssembly)';

export const TRUST_PILL_LOCAL = 'Runs in your browser';

export type ShareTarget = 'drive' | 'mail' | 'slack' | 'more';

/**
 * File actions a native host adds to the result screen. The browser has none;
 * the desktop build swaps this module for one that talks to the app.
 */
export interface NativeOutputActions {
  /** Calls back with the path each time the user saves the result; returns an unsubscribe. */
  onSaved(callback: (path: string) => void): () => void;
  reveal(path: string): void;
  /**
   * Hands the result to another app. 'revealed' means the host could only open
   * the destination and show the file, so the user drags it in.
   */
  share(outputUrl: string, target: ShareTarget): Promise<'opened' | 'revealed'>;
}

export const nativeOutput: NativeOutputActions | null = null;
