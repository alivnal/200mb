import React from 'react';
import { createRoot } from 'react-dom/client';
import Providers from '@/app/providers';
import SquishApp from '@/components/SquishApp';
import { istanbulDaylight } from '@/lib/daylight';
import { installDesktopShell } from './desktop-shell';
import './styles.css';

// Same first-paint theme as the web layout script (saved choice, else Istanbul
// daylight), applied before React renders so a night launch does not flash light.
try {
  const stored = localStorage.getItem('theme');
  const theme = stored === 'light' || stored === 'dark' ? stored : istanbulDaylight(Date.now()).theme;
  document.documentElement.setAttribute('data-theme', theme);
} catch {
  // Storage can be unavailable; the provider applies the theme after mount.
}

installDesktopShell();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <SquishApp />
    </Providers>
  </React.StrictMode>,
);
