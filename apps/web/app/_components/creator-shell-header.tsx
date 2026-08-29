'use client';

import Link from 'next/link';
import { User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { getSupabaseBrowserClient } from '../../lib/supabase-browser';
import { Brand } from './brand';

export function CreatorShellHeader() {
  const pathname = usePathname();
  const router = useRouter();
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
    <header className="creatorShellHeader">
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
          <Link href="/dashboard">Dashboard</Link>
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
        </div>
      </div>
    </header>
  );
}
