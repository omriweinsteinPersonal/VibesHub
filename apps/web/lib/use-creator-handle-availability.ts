'use client';

import type { CreatorHandleAvailability } from '@vibeshub/contracts';
import { useEffect, useState } from 'react';

import { apiRequest } from './api';
import { isCreatorHandle } from './creator-handle';

export type CreatorHandleStatus =
  'idle' | 'checking' | 'available' | 'unavailable' | 'invalid';

export function useCreatorHandleAvailability({
  currentHandle,
  endpoint,
  handle,
}: {
  currentHandle: string | null | undefined;
  endpoint: string;
  handle: string;
}): CreatorHandleStatus {
  const [remoteResult, setRemoteResult] = useState<{
    handle: string;
    status: 'available' | 'unavailable' | 'idle';
  }>({ handle: '', status: 'idle' });

  useEffect(() => {
    if (!isCreatorHandle(handle) || handle === currentHandle) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      void apiRequest<CreatorHandleAvailability>(
        `${endpoint}?handle=${encodeURIComponent(handle)}`,
      )
        .then(({ available }) => {
          if (active) {
            setRemoteResult({
              handle,
              status: available ? 'available' : 'unavailable',
            });
          }
        })
        .catch(() => {
          if (active) setRemoteResult({ handle, status: 'idle' });
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [currentHandle, endpoint, handle]);

  if (!handle) return 'idle';
  if (!isCreatorHandle(handle)) return 'invalid';
  if (handle === currentHandle) return 'available';
  return remoteResult.handle === handle ? remoteResult.status : 'checking';
}
