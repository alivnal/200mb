export const LOCALE_STORAGE_KEY = 'squik-locale';

export type AppLocale = 'en' | 'tr';

export const SUPPORTED_LOCALES: { code: AppLocale; labelKey: string }[] = [
  { code: 'en', labelKey: 'language.en' },
  { code: 'tr', labelKey: 'language.tr' },
];

export function resolveInitialLocale(): AppLocale {
  if (typeof window === 'undefined') return 'en';

  const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (saved === 'en' || saved === 'tr') return saved;

  return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}
