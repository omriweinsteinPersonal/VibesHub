'use client';

import Link from 'next/link';
import { ChartColumn, House, LayoutDashboard, LogOut, Store, User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '../../lib/supabase-browser';
import { Brand } from './brand';
import { useCreatorNavigation } from './creator-navigation-provider';

export function CreatorShellHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    clearStorefrontHref,
    ensureStorefrontHref,
    pendingHref,
    startNavigation,
    storefrontHref,
  } = useCreatorNavigation();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void ensureStorefrontHref().catch(() => undefined);
  }, [ensureStorefrontHref]);

  const links = [
    { href: '/creator-home', icon: House, label: 'Home' },
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: storefrontHref, icon: Store, label: 'Storefront' },
    { href: '/analytics', icon: ChartColumn, label: 'Analytics' },
    { href: '/account', icon: User, label: 'Account' },
  ];

  async function signOut() {
    setSigningOut(true);
    try {
      await getSupabaseBrowserClient().auth.signOut();
      clearStorefrontHref();
      router.replace('/');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <header className="creatorShellHeader">
        <div className="creatorShellHeaderInner">
          <Brand />
          <nav aria-label="Creator workspace">
            {links
              .filter(({ label }) => label !== 'Account')
              .map((link) => (
                <Link
                  aria-current={pathname === link.href ? 'page' : undefined}
                  aria-disabled={!link.href || undefined}
                  data-pending={pendingHref === link.href || undefined}
                  href={link.href ?? pathname}
                  key={link.label}
                  onClick={(event) => {
                    if (!link.href) event.preventDefault();
                  }}
                  onNavigate={() => {
                    if (link.href) startNavigation(link.href);
                  }}
                  tabIndex={link.href ? undefined : -1}
                >
                  {link.label}
                </Link>
              ))}
          </nav>
          <div className="creatorShellActions">
            <Link
              aria-current={pathname === '/account' ? 'page' : undefined}
              data-pending={pendingHref === '/account' || undefined}
              href="/account"
              onNavigate={() => startNavigation('/account')}
            >
              <User aria-hidden="true" size={16} />
              Account
            </Link>
            <button
              className="button secondary"
              disabled={signingOut}
              onClick={signOut}
              type="button"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
            <button
              aria-label={signingOut ? 'Signing out' : 'Sign out'}
              className="creatorMobileSignOut"
              disabled={signingOut}
              onClick={signOut}
              title="Sign out"
              type="button"
            >
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <nav aria-label="Mobile creator workspace" className="creatorBottomBar">
        {links.map(({ href, icon: Icon, label }) => (
          <Link
            aria-current={pathname === href ? 'page' : undefined}
            aria-disabled={!href || undefined}
            data-pending={pendingHref === href || undefined}
            href={href ?? pathname}
            key={label}
            onClick={(event) => {
              if (!href) event.preventDefault();
            }}
            onNavigate={() => {
              if (href) startNavigation(href);
            }}
            tabIndex={href ? undefined : -1}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
