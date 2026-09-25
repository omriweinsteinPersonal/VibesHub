'use client';

import type { CreatorProfileSettings } from '@vibeshub/contracts';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { apiRequest } from '../../lib/api';

interface CreatorNavigationContextValue {
  clearStorefrontHref: () => void;
  ensureStorefrontHref: () => Promise<void>;
  setStorefrontHandle: (handle: string) => void;
  storefrontHref: string | null;
}

const CreatorNavigationContext = createContext<CreatorNavigationContextValue | null>(
  null,
);

export function CreatorNavigationProvider({ children }: { children: ReactNode }) {
  const [storefrontHref, setStorefrontHref] = useState<string | null>(null);
  const requestRef = useRef<Promise<void> | null>(null);

  const setStorefrontHandle = useCallback((handle: string) => {
    setStorefrontHref(`/creator/${encodeURIComponent(handle)}`);
  }, []);

  const clearStorefrontHref = useCallback(() => {
    setStorefrontHref(null);
  }, []);

  const ensureStorefrontHref = useCallback(async () => {
    if (storefrontHref || requestRef.current) {
      await requestRef.current;
      return;
    }

    requestRef.current = apiRequest<CreatorProfileSettings>('/creator/profile')
      .then(({ handle }) => setStorefrontHandle(handle))
      .finally(() => {
        requestRef.current = null;
      });

    await requestRef.current;
  }, [setStorefrontHandle, storefrontHref]);

  const value = useMemo(
    () => ({
      clearStorefrontHref,
      ensureStorefrontHref,
      setStorefrontHandle,
      storefrontHref,
    }),
    [clearStorefrontHref, ensureStorefrontHref, setStorefrontHandle, storefrontHref],
  );

  return (
    <CreatorNavigationContext.Provider value={value}>
      {children}
    </CreatorNavigationContext.Provider>
  );
}

export function useCreatorNavigation() {
  const value = useContext(CreatorNavigationContext);
  if (!value) {
    throw new Error('useCreatorNavigation must be used within CreatorNavigationProvider');
  }
  return value;
}
