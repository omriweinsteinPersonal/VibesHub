import '@vibeshub/design-tokens/tokens.css';
import './forms.css';
import './styles.css';

import type { Metadata, Viewport } from 'next';
import { DM_Sans, Instrument_Serif } from 'next/font/google';
import type { ReactNode } from 'react';

const bodyFont = DM_Sans({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-vh-body',
});

const displayFont = Instrument_Serif({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-vh-display',
  weight: '400',
});

export const metadata: Metadata = {
  description: 'Authentic recommendations from Israeli creators.',
  title: {
    default: 'VibesHub',
    template: '%s · VibesHub',
  },
};

export const viewport: Viewport = {
  initialScale: 1,
  viewportFit: 'cover',
  width: 'device-width',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={`${bodyFont.variable} ${displayFont.variable}`} lang="en">
      <body>{children}</body>
    </html>
  );
}
