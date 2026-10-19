import { app, screen, type BrowserWindow, type Rectangle } from 'electron';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_SIZE = { width: 1180, height: 820 };

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

/** The last window frame, if it still fits on a connected display; else the default size, centred. */
export function restoreWindowBounds(): Partial<Rectangle> {
  const saved = readState();
  if (!saved) return DEFAULT_SIZE;
  const visible = screen.getAllDisplays().some(({ workArea }) =>
    saved.x >= workArea.x - 40 &&
    saved.y >= workArea.y - 40 &&
    saved.x + saved.width <= workArea.x + workArea.width + 40 &&
    saved.y + saved.height <= workArea.y + workArea.height + 40,
  );
  if (!visible || !(saved.width > 0 && saved.height > 0)) return DEFAULT_SIZE;
  const { x, y, width, height } = saved;
  return { x, y, width, height };
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
