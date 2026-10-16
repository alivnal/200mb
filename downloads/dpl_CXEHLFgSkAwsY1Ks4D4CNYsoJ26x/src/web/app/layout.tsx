/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Metadata } from 'next';
import { Pixelify_Sans } from 'next/font/google';
import './globals.css';

const pixelifySans = Pixelify_Sans({
  subsets: ['latin'],
  variable: '--font-pixel',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Squik',
  description: 'Compress academic videos under 200 MB — entirely in your browser.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${pixelifySans.variable} ${pixelifySans.className}`}>{children}</body>
    </html>
  );
}
