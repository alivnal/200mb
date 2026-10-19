/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { istanbulDaylight } from '@/lib/daylight';
import Providers from './providers';
import './globals.css';

// Sets the theme before first paint (saved choice, else day or night in
// Istanbul), so a night visit does not flash light while React loads.
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var t=s==='light'||s==='dark'?s:(${istanbulDaylight.toString()})(Date.now()).theme;document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

export const metadata: Metadata = {
  title: 'Squik — Compress videos under 200 MB',
  description: 'Compress, merge, and trim videos in your browser. Your files stay on your device.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme script sets data-theme before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
