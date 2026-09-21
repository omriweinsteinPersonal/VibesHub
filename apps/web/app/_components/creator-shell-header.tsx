'use client';

import type { CreatorProfileSettings } from '@vibeshub/contracts';
import Link from 'next/link';
import { ChartColumn, House, LayoutDashboard, LogOut, Store, User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiRequest } from '../../lib/api';
import { getSupabaseBrowserClient } from '../../lib/supabase-browser';
import { Brand } from './brand';

export function CreatorShellHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [storefrontHref, setStorefrontHref] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void apiRequest<CreatorProfileSettings>('/creator/profile')
      .then(({ handle }) => { if (active) setStorefrontHref(`/creators/${encodeURIComponent(handle)}`); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  const links = [
    { href: '/creator-home', icon: House, label: 'Home' },
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ...(storefrontHref ? [{ href: storefrontHref, icon: Store, label: 'Storefront' }] : []),
    { href: '/analytics', icon: ChartColumn, label: 'Analytics' },
    { href: '/account', icon: User, label: 'Account' },
  ];

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace('/');
    router.refresh();
  }

  return (
    <>
      <header className="creatorShellHeader">
        <div className="creatorShellHeaderInner">
          <Brand />
          <nav aria-label="Creator workspace">
            {links.filter(({ label }) => label !== 'Account').map((link) => (
              <Link
                aria-current={pathname === link.href ? 'page' : undefined}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="creatorShellActions">
            <Link
              aria-current={pathname === '/account' ? 'page' : undefined}
              href="/account"
            >
              <User aria-hidden="true" size={16} />
              Account
            </Link>
            <button className="button secondary" onClick={signOut} type="button">
              Sign out
            </button>
            <button
              aria-label="Sign out"
              className="creatorMobileSignOut"
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
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
