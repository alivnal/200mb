/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { LanguagePicker } from '@squish/i18n/react';
import { useTheme } from '@/app/providers';
import MaterialIcon from './MaterialIcon';
import SquikLogo from './SquikLogo';

export default function AppHeader() {
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <header className="app-header" data-ui="app-header">
      <Link href="/" className="app-header-brand" aria-label="Squik home">
        <SquikLogo />
      </Link>
      <div className="app-header-controls">
        <button
          type="button"
          onClick={() => setTheme(nextTheme)}
          className="theme-toggle"
          aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          <MaterialIcon name={resolvedTheme === 'dark' ? 'light_mode' : 'dark_mode'} size={18} />
        </button>
        <LanguagePicker className="app-site-footer-picker" />
      </div>
    </header>
  );
}
