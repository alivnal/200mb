/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Metadata } from 'next';
import { Jersey_25 } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Providers from './providers';
import './globals.css';

const jersey25 = Jersey_25({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-jersey',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '200mb',
  description: 'Compress, merge, and trim academic videos under 200 MB — entirely in your browser.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jersey25.variable}>
      <body className={jersey25.className}>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
