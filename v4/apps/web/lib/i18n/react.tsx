'use client';

import React, { useEffect, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, type AppLocale } from './config';
import { getI18nInstance } from './i18n';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [i18n] = useState(() => getI18nInstance());

  useEffect(() => {
    const syncLang = () => {
      document.documentElement.lang = i18n.language;
    };
    syncLang();
    i18n.on('languageChanged', syncLang);
    return () => {
      i18n.off('languageChanged', syncLang);
    };
  }, [i18n]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

interface LanguagePickerProps {
  className?: string;
}

export function LanguagePicker({ className = '' }: LanguagePickerProps) {
  const { i18n, t } = useTranslation();
  const current = (i18n.language === 'tr' ? 'tr' : 'en') as AppLocale;

  return (
    <div
      className={`language-picker ${className}`}
      role="group"
      aria-label={t('language.label')}
    >
      {SUPPORTED_LOCALES.map(({ code, labelKey }) => {
        const active = current === code;
        return (
          <button
            key={code}
            type="button"
            className={`language-picker-btn${active ? ' is-active' : ''}`}
            aria-pressed={active}
            onClick={() => i18n.changeLanguage(code)}
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
