/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import { Trans } from 'react-i18next';
import { LanguagePicker } from '@squish/i18n/react';

export default function AppFooter() {
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
      <LanguagePicker className="app-site-footer-picker" />
    </footer>
  );
}
