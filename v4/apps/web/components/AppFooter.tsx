/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import { Trans } from 'react-i18next';
import { LanguagePicker } from '@squish/i18n/react';
import { useTheme } from '@/app/providers';
import MaterialIcon from './MaterialIcon';

export default function AppFooter() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <footer className="app-site-footer">
      <p className="app-site-footer-text">
        <Trans
          i18nKey="footer.text"
          components={{
            heart: <span aria-hidden>💙</span>,
            channel: <span className="text-accent font-medium" />,
          }}
        />
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          <MaterialIcon
            name={resolvedTheme === 'dark' ? 'light_mode' : 'dark_mode'}
            size={16}
          />
        </button>
        <LanguagePicker className="app-site-footer-picker" />
      </div>
    </footer>
  );
}
