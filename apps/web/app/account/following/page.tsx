'use client';

import type { FollowedCreator } from '@vibeshub/contracts';
import { useEffect, useState } from 'react';

import { apiCollectionRequest } from '../../../lib/api';
import { CreatorCardView } from '../../_components/creator-card';
import { EngagementProvider, FollowCreatorButton } from '../../_components/engagement';
import { WorkspaceHeader } from '../../_components/workspace-header';

export default function FollowedCreatorsPage() {
  const [items, setItems] = useState<FollowedCreator[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadPage();
  }, []);

  async function loadPage(cursor?: string) {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ limit: '12' });
      if (cursor) query.set('cursor', cursor);
      const page = await apiCollectionRequest<FollowedCreator>(
        `/me/followed-creators?${query.toString()}`,
      );
      setItems((current) => (cursor ? [...current, ...page.data] : page.data));
      setNextCursor(page.page.nextCursor);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load followed creators.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="workspacePage">
      <WorkspaceHeader />
      <section className="workspaceContent shopperCollection">
        <p className="eyebrow">YOUR COMMUNITY</p>
        <h1>Creators you follow</h1>
        <p className="lede">The storefronts whose taste you want to revisit.</p>
        {error ? <p className="formError">{error}</p> : null}
        {loading && items.length === 0 ? <p role="status">Loading creators…</p> : null}
        {!loading && items.length === 0 && !error ? (
          <div className="directoryState">
            <h2>You are not following anyone yet</h2>
            <p>Open a creator storefront and choose Follow creator.</p>
          </div>
        ) : null}
        {items.length > 0 ? (
          <EngagementProvider creatorIds={items.map(({ creator }) => creator.id)}>
            <div className="creatorGrid">
              {items.map(({ creator }) => (
                <CreatorCardView
                  actions={
                    <FollowCreatorButton
                      creatorId={creator.id}
                      onChange={(followed) => {
                        if (!followed) {
                          setItems((current) =>
                            current.filter((item) => item.creator.id !== creator.id),
                          );
                        }
                      }}
                    />
                  }
                  creator={creator}
                  key={creator.id}
                />
              ))}
            </div>
          </EngagementProvider>
        ) : null}
        {nextCursor ? (
          <button
            className="button secondary loadMore"
            disabled={loading}
            type="button"
            onClick={() => void loadPage(nextCursor)}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        ) : null}
      </section>
    </main>
  );
}
