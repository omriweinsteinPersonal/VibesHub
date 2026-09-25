'use client';

import type { CreatorProfileSettings } from '@vibeshub/contracts';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { apiRequest } from '../../lib/api';

interface CreatorNavigationContextValue {
  clearStorefrontHref: () => void;
  creatorProfile: CreatorProfileSettings | null;
  ensureStorefrontHref: () => Promise<void>;
  pendingHref: string | null;
  setCreatorProfile: (profile: CreatorProfileSettings) => void;
  startNavigation: (href: string) => void;
  storefrontHref: string | null;
}

const CreatorNavigationContext = createContext<CreatorNavigationContextValue | null>(
  null,
);

export function CreatorNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingNavigation, setPendingNavigation] = useState<{
    fromPath: string;
    href: string;
  } | null>(null);
  const [creatorProfile, setCreatorProfileState] =
    useState<CreatorProfileSettings | null>(null);
  const [storefrontHref, setStorefrontHref] = useState<string | null>(null);
  const requestRef = useRef<Promise<void> | null>(null);
  const pendingHref =
    pendingNavigation?.fromPath === pathname ? pendingNavigation.href : null;

  const setPendingHref = useCallback(
    (href: string | null) => {
      setPendingNavigation(href ? { fromPath: pathname, href } : null);
    },
    [pathname],
  );

  const setCreatorProfile = useCallback((profile: CreatorProfileSettings) => {
    setCreatorProfileState(profile);
    setStorefrontHref(`/creator/${encodeURIComponent(profile.handle)}`);
  }, []);

  const clearStorefrontHref = useCallback(() => {
    setCreatorProfileState(null);
    setStorefrontHref(null);
  }, []);

  const startNavigation = useCallback(
    (href: string) => {
      if (href.split('?')[0] === pathname) return;
      setPendingHref(href);
    },
    [pathname, setPendingHref],
  );

  useEffect(() => {
    if (!pendingHref) return;
    const timer = window.setTimeout(() => setPendingHref(null), 12_000);
    return () => window.clearTimeout(timer);
  }, [pendingHref, setPendingHref]);

  useEffect(() => {
    function handleInternalLink(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.download || anchor.target === '_blank') return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      setPendingHref(`${destination.pathname}${destination.search}`);
    }

    document.addEventListener('click', handleInternalLink, true);
    return () => document.removeEventListener('click', handleInternalLink, true);
  }, [setPendingHref]);

  useEffect(() => {
    if (storefrontHref) router.prefetch(storefrontHref);
  }, [router, storefrontHref]);

  const ensureStorefrontHref = useCallback(async () => {
    if (creatorProfile || requestRef.current) {
      await requestRef.current;
      return;
    }

    requestRef.current = apiRequest<CreatorProfileSettings>('/creator/profile')
      .then(setCreatorProfile)
      .finally(() => {
        requestRef.current = null;
      });

    await requestRef.current;
  }, [creatorProfile, setCreatorProfile]);

  const value = useMemo(
    () => ({
      clearStorefrontHref,
      creatorProfile,
      ensureStorefrontHref,
      pendingHref,
      setCreatorProfile,
      startNavigation,
      storefrontHref,
    }),
    [
      clearStorefrontHref,
      creatorProfile,
      ensureStorefrontHref,
      pendingHref,
      setCreatorProfile,
      startNavigation,
      storefrontHref,
    ],
  );

  return (
    <CreatorNavigationContext.Provider value={value}>
      {children}
      {pendingHref ? <NavigationProgress key={pendingHref} /> : null}
    </CreatorNavigationContext.Provider>
  );
}

function NavigationProgress() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div aria-label="Opening page" className="creatorNavigationProgress" role="status">
      <span />
    </div>
  );
}

export function useCreatorNavigation() {
  const value = useContext(CreatorNavigationContext);
  if (!value) {
    throw new Error('useCreatorNavigation must be used within CreatorNavigationProvider');
  }
  return value;
}
