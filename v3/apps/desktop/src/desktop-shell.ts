/**
 * Desktop-only glue around the shared web UI: macOS and Windows window chrome
 * hooks, the menu bar, native theme, and copy that should name the desktop
 * (Finder on the Mac) rather than a browser.
 */

import { getI18nInstance } from '@squish/i18n';

type Copy = Record<'en' | 'tr', Record<string, string>>;

const DESKTOP_COPY: Copy = {
  en: { 'success.downloadFile': 'Save…' },
  tr: { 'success.downloadFile': 'Kaydet…' },
};

// Windows keeps the shared "Show in Folder", as Explorer is the folder.
const MAC_COPY: Copy = {
  en: { 'success.showInFolder': 'Show in Finder' },
  tr: { 'success.showInFolder': "Finder'da Göster" },
};

export function installDesktopShell(): void {
  const root = document.documentElement;
  const desktop = window.squikDesktop;
  const isMac = navigator.userAgent.includes('Mac');
  if (isMac) root.dataset.platform = 'mac';
  else if (navigator.userAgent.includes('Windows')) root.dataset.platform = 'win';

  const i18n = getI18nInstance();
  for (const language of ['en', 'tr'] as const) {
    // The shared copy talks about a browser tab; on desktop it is a window.
    i18n.addResource(language, 'translation', 'status.keepTabOpen', i18n.t('status.keepWindowOpen', { lng: language }));
    for (const [key, value] of Object.entries({ ...DESKTOP_COPY[language], ...(isMac ? MAC_COPY[language] : {}) })) {
      i18n.addResource(language, 'translation', key, value);
    }
  }

  if (!desktop) return;

  // Traffic lights and caption buttons hide in full screen, so the header no
  // longer makes room for them.
  desktop.onFullScreenChange((fullScreen) => {
    root.toggleAttribute('data-fullscreen', fullScreen);
  });

  // File ▸ Open Video… (⌘O, Ctrl+O) opens the same picker as the drop zone.
  window.addEventListener('squik:menu-command', (event) => {
    if ((event as CustomEvent<string>).detail !== 'open-video') return;
    document.querySelector<HTMLInputElement>('input[type="file"]')?.click();
  });

  // Native dialogs, menus and the Windows caption buttons follow the page's
  // light or dark theme.
  const syncTheme = () => {
    const theme = root.getAttribute('data-theme');
    if (theme === 'light' || theme === 'dark') void desktop.setTheme(theme);
  };
  syncTheme();
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
}
