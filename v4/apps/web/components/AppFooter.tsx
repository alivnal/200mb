/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';

export default function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="app-site-footer">
      <a
        className="app-site-footer-author"
        href="https://github.com/alivnal"
        target="_blank"
        rel="noopener noreferrer"
      >
        ali ünal
      </a>
      <p className="app-site-footer-credit">Squik · {t('landing.footerNote')}</p>
    </footer>
  );
}
