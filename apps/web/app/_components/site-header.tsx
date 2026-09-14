'use client';

import Link from 'next/link';
import { Compass, Heart, House, LogIn, LogOut, UserRound, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, apiRequest } from '../../lib/api';
import { getSupabaseBrowserClient } from '../../lib/supabase-browser';
import { Brand } from './brand';
import { GlobalSearch } from './global-search';

interface AccountSummary {
  creator: { id: string } | null;
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [shopperSession, setShopperSession] = useState(false);
  const publicLinks = [
    { href: '/creators', label: 'Creators' },
    { href: '/discover', label: 'Discover' },
    { href: '/about', label: 'About' },
  ];
  const shopperLinks = [
    { href: '/', label: 'Home' },
    { href: '/creators', label: 'Creators' },
    { href: '/discover', label: 'Discover' },
    { href: '/account/saved', label: 'My List' },
  ];
  const links = shopperSession ? shopperLinks : publicLinks;
  const mobileLinks = [
    { active: pathname === '/', href: '/', icon: House, label: 'Home' },
    {
      active: pathname.startsWith('/creators'),
      href: '/creators',
      icon: Users,
      label: 'Creators',
    },
    {
      active: pathname.startsWith('/discover'),
      href: '/discover',
      icon: Compass,
      label: 'Discover',
    },
    shopperSession
      ? {
          active: pathname.startsWith('/account/saved'),
          href: '/account/saved',
          icon: Heart,
          label: 'My List',
        }
      : {
          active: pathname.startsWith('/auth') || pathname === '/login',
          href: '/auth?mode=login',
          icon: LogIn,
          label: 'Login',
        },
  ];

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    async function refreshShopperSession() {
      try {
        const account = await apiRequest<AccountSummary>('/me');
        if (active) setShopperSession(!account.creator);
      } catch (cause) {
        if (!active) return;
        setShopperSession(false);
        if (!(cause instanceof ApiError && cause.status === 401)) {
          console.error('Could not resolve the site navigation session', cause);
        }
      }
    }

    void refreshShopperSession();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refreshShopperSession();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    setShopperSession(false);
    router.replace('/');
    router.refresh();
  }

  return (
    <>
      <header className="siteHeader">
        <div className="siteHeaderInner">
          <Brand />
          <nav aria-label="Primary navigation">
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
          <div className="actions">
            <GlobalSearch />
            {shopperSession ? (
              <>
                <Link
                  aria-label="Account"
                  className="siteHeaderIconAction shopperAccountLink"
                  href="/account"
                  title="Account"
                >
                  <UserRound aria-hidden="true" />
                </Link>
                <button
                  aria-label="Sign out"
                  className="siteHeaderIconAction shopperSignOut"
                  onClick={() => void signOut()}
                  title="Sign out"
                  type="button"
                >
                  <LogOut aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <Link className="loginLink" href="/auth?mode=login">
                  Login
                </Link>
                <Link
                  className="button primary joinCreatorLink"
                  href="/auth?mode=signup&amp;role=creator"
                >
                  Join as Creator
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <nav aria-label="Mobile navigation" className="mobileTabBar">
        {mobileLinks.map(({ active, href, icon: Icon, label }) => (
          <Link aria-current={active ? 'page' : undefined} href={href} key={href}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
