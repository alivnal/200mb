/**
 * Desktop stand-in for the web app's lib/platform: the same exports, with the
 * native file actions filled in.
 */

import type { NativeOutputActions } from '../../../../v4/apps/web/lib/platform';

export { TRUST_PILL_LOCAL, type NativeOutputActions, type ShareTarget } from '../../../../v4/apps/web/lib/platform';

export const ENCODER_LABEL = 'FFmpeg (native)';

export const nativeOutput: NativeOutputActions | null = window.squikDesktop
  ? {
      save: (outputUrl) => window.squikDesktop!.saveOutput(outputUrl),
      reveal: (path) => void window.squikDesktop!.revealOutput(path),
      share: (outputUrl, target) => window.squikDesktop!.shareOutput(outputUrl, target),
    }
  : null;
