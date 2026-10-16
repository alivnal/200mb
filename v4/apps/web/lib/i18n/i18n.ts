import i18n, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LOCALE_STORAGE_KEY, resolveInitialLocale, type AppLocale } from './config';
import en from './locales/en.json';
import tr from './locales/tr.json';

let instance: I18nInstance | null = null;

export function getI18nInstance(): I18nInstance {
  if (instance) return instance;

  instance = i18n.createInstance();

  instance.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      tr: { translation: tr },
    },
    lng: resolveInitialLocale(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

  instance.on('languageChanged', (lng) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LOCALE_STORAGE_KEY, lng);
    document.documentElement.lang = lng;
  });

  if (typeof document !== 'undefined') {
    document.documentElement.lang = instance.language;
  }

  return instance;
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
