'use client';

import Link from 'next/link';
import { Menu, User, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { getSupabaseBrowserClient } from '../../lib/supabase-browser';
import { Brand } from './brand';

export function CreatorShellHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    { href: '/creator-home', label: 'Home' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/analytics', label: 'Analytics' },
  ];

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace('/');
    router.refresh();
  }

  return (
    <header className="creatorShellHeader" data-menu-open={menuOpen || undefined}>
      <div className="creatorShellHeaderInner">
        <Brand />
        <nav aria-label="Creator workspace">
          {links.map((link) => (
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
            aria-controls="mobile-creator-navigation"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            className="mobileMenuButton"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        <nav
          aria-label="Mobile creator workspace"
          className="mobileNavigation creatorMobileNavigation"
          id="mobile-creator-navigation"
        >
          {links.map((link) => (
            <Link
              aria-current={pathname === link.href ? 'page' : undefined}
              href={link.href}
              key={link.href}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/account" onClick={() => setMenuOpen(false)}>
            <User aria-hidden="true" size={18} />
            Account
          </Link>
          <button onClick={signOut} type="button">
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
