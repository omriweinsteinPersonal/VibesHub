'use client';

import type { EngagementState } from '@vibeshub/contracts';
import { useRouter } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Heart } from 'lucide-react';

import { ApiError, apiRequest } from '../../lib/api';

interface EngagementContextValue {
  busyKeys: ReadonlySet<string>;
  followedCreatorIds: ReadonlySet<string>;
  ready: boolean;
  savedProductIds: ReadonlySet<string>;
  toggleCreator: (creatorId: string) => Promise<boolean>;
  toggleProduct: (productId: string, recommendationId: string) => Promise<boolean>;
}

const EngagementContext = createContext<EngagementContextValue | null>(null);

interface EngagementProviderProps {
  children: ReactNode;
  creatorIds?: string[];
  productIds?: string[];
}

export function EngagementProvider({
  children,
  creatorIds = [],
  productIds = [],
}: EngagementProviderProps) {
  const router = useRouter();
  const [followedCreatorIds, setFollowedCreatorIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [savedProductIds, setSavedProductIds] = useState<Set<string>>(() => new Set());
  const [busyKeys, setBusyKeys] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const creatorKey = creatorIds.join(',');
  const productKey = productIds.join(',');

  useEffect(() => {
    let active = true;
    void apiRequest<EngagementState>('/me/engagement-state', {
      body: JSON.stringify({ creatorIds, productIds }),
      method: 'POST',
    })
      .then((state) => {
        if (!active) return;
        setFollowedCreatorIds(new Set(state.followedCreatorIds));
        setSavedProductIds(new Set(state.savedProductIds));
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof ApiError && cause.status === 401)) {
          console.error('Could not load shopper engagement state', cause);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
    // Stable primitive keys prevent repeated requests when a parent recreates its arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorKey, productKey]);

  const withOptimisticMutation = useCallback(
    async (
      key: string,
      current: boolean,
      setValues: (update: (values: Set<string>) => Set<string>) => void,
      request: () => Promise<void>,
    ): Promise<boolean> => {
      const next = !current;
      setBusyKeys((keys) => new Set(keys).add(key));
      setValues((values) => updateSet(values, key.slice(key.indexOf(':') + 1), next));
      try {
        await request();
        return next;
      } catch (cause) {
        setValues((values) =>
          updateSet(values, key.slice(key.indexOf(':') + 1), current),
        );
        if (cause instanceof ApiError && cause.status === 401) {
          const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          router.push(`/login?next=${encodeURIComponent(next)}`);
        }
        throw cause;
      } finally {
        setBusyKeys((keys) => {
          const updated = new Set(keys);
          updated.delete(key);
          return updated;
        });
      }
    },
    [router],
  );

  const toggleCreator = useCallback(
    async (creatorId: string) => {
      const current = followedCreatorIds.has(creatorId);
      return withOptimisticMutation(
        `creator:${creatorId}`,
        current,
        setFollowedCreatorIds,
        () =>
          apiRequest<void>(`/me/followed-creators/${creatorId}`, {
            method: current ? 'DELETE' : 'PUT',
          }),
      );
    },
    [followedCreatorIds, withOptimisticMutation],
  );

  const toggleProduct = useCallback(
    async (productId: string, recommendationId: string) => {
      const current = savedProductIds.has(productId);
      return withOptimisticMutation(
        `product:${productId}`,
        current,
        setSavedProductIds,
        () =>
          apiRequest<void>(
            `/me/saved-products/${productId}`,
            current
              ? { method: 'DELETE' }
              : {
                  body: JSON.stringify({ sourceRecommendationId: recommendationId }),
                  method: 'PUT',
                },
          ),
      );
    },
    [savedProductIds, withOptimisticMutation],
  );

  const value = useMemo<EngagementContextValue>(
    () => ({
      busyKeys,
      followedCreatorIds,
      ready,
      savedProductIds,
      toggleCreator,
      toggleProduct,
    }),
    [busyKeys, followedCreatorIds, ready, savedProductIds, toggleCreator, toggleProduct],
  );

  return <EngagementContext value={value}>{children}</EngagementContext>;
}

export function FollowCreatorButton({
  creatorId,
  onChange,
}: {
  creatorId: string;
  onChange?: (followed: boolean) => void;
}) {
  const engagement = useContext(EngagementContext);
  const [error, setError] = useState('');
  if (!engagement) return null;
  const followed = engagement.followedCreatorIds.has(creatorId);
  const busy = engagement.busyKeys.has(`creator:${creatorId}`);

  return (
    <div className="engagementAction">
      <button
        aria-pressed={followed}
        className={`button ${followed ? 'secondary' : 'primary'}`}
        disabled={!engagement.ready || busy}
        type="button"
        onClick={() => {
          setError('');
          void engagement
            .toggleCreator(creatorId)
            .then((next) => onChange?.(next))
            .catch((cause: unknown) =>
              setError(
                cause instanceof Error ? cause.message : 'Could not update follow.',
              ),
            );
        }}
      >
        {busy ? 'Updating…' : followed ? 'Following' : 'Follow creator'}
      </button>
      {error ? <span role="status">{error}</span> : null}
    </div>
  );
}

interface SaveProductButtonProps {
  onChange?: ((saved: boolean) => void) | undefined;
  productId: string;
  recommendationId: string;
}

export function SaveProductButton({
  onChange,
  productId,
  recommendationId,
}: SaveProductButtonProps) {
  const engagement = useContext(EngagementContext);
  const [error, setError] = useState('');
  if (!engagement) return null;
  const saved = engagement.savedProductIds.has(productId);
  const busy = engagement.busyKeys.has(`product:${productId}`);

  return (
    <button
      aria-label={saved ? 'Remove from saved products' : 'Save product'}
      aria-pressed={saved}
      className={`saveProductButton ${saved ? 'saved' : ''}`}
      disabled={!engagement.ready || busy}
      title={error || (saved ? 'Saved' : 'Save product')}
      type="button"
      onClick={() => {
        setError('');
        void engagement
          .toggleProduct(productId, recommendationId)
          .then((next) => onChange?.(next))
          .catch((cause: unknown) =>
            setError(cause instanceof Error ? cause.message : 'Could not update save.'),
          );
      }}
    >
      <span aria-hidden="true">
        {busy ? '…' : <Heart fill={saved ? 'currentColor' : 'none'} size={16} />}
      </span>
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}

function updateSet(values: Set<string>, id: string, included: boolean): Set<string> {
  const updated = new Set(values);
  if (included) updated.add(id);
  else updated.delete(id);
  return updated;
}
