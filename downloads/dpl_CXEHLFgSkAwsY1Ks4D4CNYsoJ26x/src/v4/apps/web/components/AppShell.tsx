/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import AppFooter from './AppFooter';
import PixelCursor from './PixelCursor';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-canvas text-ink">
      <PixelCursor />
      <div className="app-canvas flex-1 min-h-0 relative">{children}</div>
      <AppFooter />
    </div>
  );
}
