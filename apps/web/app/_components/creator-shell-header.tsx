'use client';

import type { CreatorProfileSettings } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { ChartColumn, House, LayoutDashboard, Store, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { Brand } from './brand';
import { useCreatorNavigation } from './creator-navigation-provider';
import { publicAssetUrl } from '../../lib/public-asset-url';

export function CreatorShellHeader({
  showBottomBar = true,
  showDesktopNavigation = true,
  homeLogo = false,
  workspaceHeader = false,
}: {
  showBottomBar?: boolean;
  showDesktopNavigation?: boolean;
  homeLogo?: boolean;
  workspaceHeader?: boolean;
} = {}) {
  const pathname = usePathname();
  const { ensureStorefrontHref, pendingHref, startNavigation, storefrontHref } =
    useCreatorNavigation();

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

  return (
    <>
      <header
        className={`creatorShellHeader${workspaceHeader ? ' creatorWorkspaceHeader' : ''}`}
      >
        <div className="creatorShellHeaderInner">
          <Brand href="/creator-home" homeLogo={homeLogo} />
          {showDesktopNavigation ? (
            <nav aria-label="Creator workspace">
              {links.map((link) => (
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
          ) : null}
        </div>
      </header>
      {showBottomBar ? <CreatorBottomBar /> : null}
    </>
  );
}

export function CreatorDesktopSidebar() {
  const pathname = usePathname();
  const { creatorProfile, pendingHref, startNavigation, storefrontHref } =
    useCreatorNavigation();
  const links = [
    { href: '/creator-home', icon: House, label: 'Home' },
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: storefrontHref, icon: Store, label: 'Storefront' },
    { href: '/analytics', icon: ChartColumn, label: 'Analytics' },
    { href: '/account', icon: User, label: 'Account' },
  ];

  return (
    <aside className="creatorDesktopSidebar">
      <CreatorSidebarIdentity profile={creatorProfile} />
      <nav aria-label="Creator workspace">
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
            <Icon aria-hidden="true" size={18} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function CreatorSidebarIdentity({ profile }: { profile: CreatorProfileSettings | null }) {
  const initials = profile?.displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <Link
      aria-label="Open account settings"
      className="creatorDesktopSidebarIdentity"
      href="/account"
    >
      <span aria-hidden="true" className="creatorDesktopSidebarAvatar">
        {profile?.avatar ? (
          <Image
            alt=""
            height={42}
            sizes="42px"
            src={publicAssetUrl(profile.avatar.url)}
            unoptimized
            width={42}
          />
        ) : (
          initials || 'S'
        )}
      </span>
      <span className="creatorDesktopSidebarIdentityCopy">
        <strong>{profile?.displayName || 'Your Swavii'}</strong>
        <small>{profile ? `swavii.com/${profile.handle}` : 'Your creator page'}</small>
      </span>
    </Link>
  );
}

export function CreatorBottomBar() {
  const pathname = usePathname();
  const { pendingHref, startNavigation, storefrontHref } = useCreatorNavigation();
  const links = [
    { href: '/creator-home', icon: House, label: 'Home' },
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: storefrontHref, icon: Store, label: 'Storefront' },
    { href: '/analytics', icon: ChartColumn, label: 'Analytics' },
    { href: '/account', icon: User, label: 'Account' },
  ];

  return (
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
  );
}
