import '@vibeshub/design-tokens/tokens.css';
import './forms.css';
import './styles.css';

import type { Metadata, Viewport } from 'next';
import { DM_Sans, Instrument_Serif } from 'next/font/google';
import type { ReactNode } from 'react';

import { CreatorNavigationProvider } from './_components/creator-navigation-provider';
import { CreatorWorkspaceFrame } from './_components/creator-workspace-frame';
import { siteDescription, siteName, siteUrl } from '../lib/site-metadata';

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
  applicationName: siteName,
  metadataBase: new URL(siteUrl),
  description: siteDescription,
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  icons: { icon: '/icon.svg' },
  openGraph: {
    description: siteDescription,
    siteName,
    title: siteName,
    type: 'website',
  },
  twitter: {
    card: 'summary',
    description: siteDescription,
    title: siteName,
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
      <body>
        <CreatorNavigationProvider>
          <CreatorWorkspaceFrame>{children}</CreatorWorkspaceFrame>
        </CreatorNavigationProvider>
      </body>
    </html>
  );
}
