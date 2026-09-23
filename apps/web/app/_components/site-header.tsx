'use client';

import Link from 'next/link';
import { House, LogIn, Sparkles, Tag } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { Brand } from './brand';

const publicLinks = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#features', label: 'Features' },
  { href: '/#pricing', label: 'Pricing' },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <>
      <header className="siteHeader creatorMarketingHeader">
        <div className="siteHeaderInner">
          <Brand />
          <nav aria-label="Primary navigation">
            {publicLinks.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
          </nav>
          <div className="actions">
            <Link className="loginLink" href="/auth?mode=login">Log in</Link>
            <Link className="button primary joinCreatorLink" href="/auth?mode=signup&role=creator">Create your page</Link>
          </div>
        </div>
      </header>
      <nav aria-label="Mobile navigation" className="mobileTabBar creatorMarketingMobileNav">
        <Link aria-current={pathname === '/' ? 'page' : undefined} href="/"><House aria-hidden="true" /><span>Home</span></Link>
        <Link href="/#features"><Sparkles aria-hidden="true" /><span>Features</span></Link>
        <Link href="/#pricing"><Tag aria-hidden="true" /><span>Pricing</span></Link>
        <Link aria-current={pathname.startsWith('/auth') ? 'page' : undefined} href="/auth?mode=login"><LogIn aria-hidden="true" /><span>Log in</span></Link>
      </nav>
    </>
  );
}
