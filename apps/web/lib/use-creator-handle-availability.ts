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
  const normalizedHandle = handle.trim();
  const normalizedCurrentHandle = currentHandle?.trim();
  const [remoteResult, setRemoteResult] = useState<{
    handle: string;
    status: 'available' | 'unavailable' | 'idle';
  }>({ handle: '', status: 'idle' });

  useEffect(() => {
    if (!isCreatorHandle(normalizedHandle) || normalizedHandle === normalizedCurrentHandle) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      void apiRequest<CreatorHandleAvailability>(
        `${endpoint}?handle=${encodeURIComponent(normalizedHandle)}`,
      )
        .then(({ available }) => {
          if (active) {
            setRemoteResult({
              handle: normalizedHandle,
              status: available ? 'available' : 'unavailable',
            });
          }
        })
        .catch(() => {
          if (active) setRemoteResult({ handle: normalizedHandle, status: 'idle' });
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [endpoint, normalizedCurrentHandle, normalizedHandle]);

  if (!normalizedHandle) return 'idle';
  if (!isCreatorHandle(normalizedHandle)) return 'invalid';
  if (normalizedHandle === normalizedCurrentHandle) return 'available';
  return remoteResult.handle === normalizedHandle ? remoteResult.status : 'checking';
}
