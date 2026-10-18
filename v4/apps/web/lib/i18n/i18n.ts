import i18n, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LOCALE_STORAGE_KEY, resolveInitialLocale, type AppLocale } from './config';
import en from './locales/en.json';
import tr from './locales/tr.json';

let instance: I18nInstance | null = null;
// Only an explicit choice is saved; the locale applied on load is not.
let persistChanges = true;

export function getI18nInstance(): I18nInstance {
  if (instance) return instance;

  instance = i18n.createInstance();

  instance.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      tr: { translation: tr },
    },
    // Server and first client render must agree, so both start in English;
    // applySavedLocale() switches to the visitor's locale after hydration.
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

  instance.on('languageChanged', (lng) => {
    if (typeof window === 'undefined') return;
    if (persistChanges) localStorage.setItem(LOCALE_STORAGE_KEY, lng);
    document.documentElement.lang = lng;
  });

  if (typeof document !== 'undefined') {
    document.documentElement.lang = instance.language;
  }

  return instance;
}

export async function applySavedLocale(): Promise<void> {
  const i18nInstance = getI18nInstance();
  const locale = resolveInitialLocale();
  if (locale === i18nInstance.language) return;
  persistChanges = false;
  try {
    await i18nInstance.changeLanguage(locale);
  } finally {
    persistChanges = true;
  }
}

export async function setAppLocale(locale: AppLocale): Promise<void> {
  await getI18nInstance().changeLanguage(locale);
}

export type CompressionPhaseKey =
  | 'preparing'
  | 'loading'
  | 'uploading'
  | 'encoding'
  | 'finalizing'
  | 'complete'
  | 'preparingMerge'
  | 'mergingClips'
  | 'trimmingClips';

export function translatePhase(phase: CompressionPhaseKey): string {
  return getI18nInstance().t(`phase.${phase}`);
}
