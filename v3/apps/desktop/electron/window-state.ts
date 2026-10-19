import { app, screen, type BrowserWindow, type Rectangle } from 'electron';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_SIZE = { width: 1180, height: 820 };
// Wide enough that the scene and the card sit side by side. Smaller screens
// (a 1366x768 laptop at 125% has about 1093x574 of work area) get their whole
// work area instead, so the window never runs under the taskbar.
const MIN_SIZE = { width: 960, height: 640 };

interface SavedState extends Rectangle {
  maximized?: boolean;
}

function statePath(): string {
  return join(app.getPath('userData'), 'window-state.json');
}

function readState(): SavedState | null {
  try {
    return JSON.parse(readFileSync(statePath(), 'utf8')) as SavedState;
  } catch {
    // First launch or an unreadable file.
    return null;
  }
}

export interface WindowGeometry extends Partial<Rectangle> {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

/**
 * The last window frame if it is still on a connected display, else the
 * default size centred; both, and the minimum size, capped to the display's
 * work area (the screen less the taskbar or Dock, in scaled pixels).
 */
export function restoreWindowGeometry(): WindowGeometry {
  const saved = readState();
  const home = saved && saved.width > 0 && saved.height > 0
    ? screen.getAllDisplays().find(({ workArea }) =>
        saved.x >= workArea.x - 40 &&
        saved.y >= workArea.y - 40 &&
        saved.x + saved.width <= workArea.x + workArea.width + 40 &&
        saved.y + saved.height <= workArea.y + workArea.height + 40,
      )
    : undefined;
  const { workArea } = home ?? screen.getPrimaryDisplay();
  const limits = {
    minWidth: Math.min(MIN_SIZE.width, workArea.width),
    minHeight: Math.min(MIN_SIZE.height, workArea.height),
  };
  if (!saved || !home) {
    return {
      width: Math.min(DEFAULT_SIZE.width, workArea.width),
      height: Math.min(DEFAULT_SIZE.height, workArea.height),
      ...limits,
    };
  }
  const width = Math.min(saved.width, workArea.width);
  const height = Math.min(saved.height, workArea.height);
  return {
    x: Math.min(Math.max(saved.x, workArea.x), workArea.x + workArea.width - width),
    y: Math.min(Math.max(saved.y, workArea.y), workArea.y + workArea.height - height),
    width,
    height,
    ...limits,
  };
}

/**
 * Saves the window frame as it changes, and whether it was maximized (the usual
 * way to run an app on Windows), which it re-applies once the page is ready, as
 * maximizing a hidden window would show it early.
 */
export function rememberWindowBounds(window: BrowserWindow): void {
  if (readState()?.maximized) window.once('ready-to-show', () => window.maximize());
  let timer: NodeJS.Timeout | undefined;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (window.isDestroyed() || window.isFullScreen() || window.isMinimized()) return;
      const state: SavedState = { ...window.getNormalBounds(), maximized: window.isMaximized() };
      void writeFile(statePath(), JSON.stringify(state)).catch(() => {});
    }, 400);
  };
  window.on('resize', save);
  window.on('move', save);
  window.on('maximize', save);
  window.on('unmaximize', save);
}
