'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { CreatorShellHeader } from './creator-shell-header';
import dashboardStyles from './creator-dashboard.module.css';
import { SiteFooter } from './site-footer';

const workspacePaths = new Set([
  '/account',
  '/analytics',
  '/creator-home',
  '/creator/analytics',
  '/dashboard',
]);

export function CreatorWorkspaceFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (!workspacePaths.has(pathname)) return children;

  return (
    <div
      className={`creatorShellPage${pathname === '/dashboard' || pathname === '/creator-home' ? ` ${dashboardStyles.shell}` : ''}`}
    >
      <CreatorShellHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
