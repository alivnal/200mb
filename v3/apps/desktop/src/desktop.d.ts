import type { DesktopApi } from '../electron/contracts';

declare global {
  interface Window {
    squikDesktop?: DesktopApi;
  }
}

export {};
