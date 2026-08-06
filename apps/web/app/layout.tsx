import '@vibeshub/design-tokens/tokens.css';
import './styles.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  description: 'Authentic recommendations from Israeli creators.',
  title: {
    default: 'VibesHub',
    template: '%s · VibesHub',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
