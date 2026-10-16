/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import SquikLogo from './SquikLogo';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-canvas text-ink">
      <header className="relative shrink-0 flex items-center justify-end px-4 py-3 border-b border-border bg-surface">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
          <SquikLogo className="h-7 w-auto mx-0" />
        </div>
        <a
          href="https://github.com"
          className="relative z-10 text-label-md text-muted hover:text-accent transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get the desktop app
        </a>
      </header>
      <div className="app-canvas flex-1 min-h-0 overflow-auto relative">{children}</div>
    </div>
  );
}
