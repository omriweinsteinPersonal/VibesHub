'use client';

import type { SavedProduct } from '@vibeshub/contracts';
import { useEffect, useState } from 'react';

import { apiCollectionRequest } from '../../../lib/api';
import { EngagementProvider } from '../../_components/engagement';
import { RecommendationCardView } from '../../_components/recommendation-card';
import { WorkspaceHeader } from '../../_components/workspace-header';

export default function SavedProductsPage() {
  const [items, setItems] = useState<SavedProduct[]>([]);
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
      const page = await apiCollectionRequest<SavedProduct>(
        `/me/saved-products?${query.toString()}`,
      );
      setItems((current) => (cursor ? [...current, ...page.data] : page.data));
      setNextCursor(page.page.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load saved products.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="workspacePage">
      <WorkspaceHeader />
      <section className="workspaceContent shopperCollection">
        <p className="eyebrow">YOUR COLLECTION</p>
        <h1>Saved products</h1>
        <p className="lede">
          Recommendations you saved, with their original creator context.
        </p>
        {error ? <p className="formError">{error}</p> : null}
        {loading && items.length === 0 ? (
          <p role="status">Loading saved products…</p>
        ) : null}
        {!loading && items.length === 0 && !error ? (
          <div className="directoryState">
            <h2>No saved products yet</h2>
            <p>Use the Save button on any creator recommendation to keep it here.</p>
          </div>
        ) : null}
        {items.length > 0 ? (
          <EngagementProvider productIds={items.map(({ productId }) => productId)}>
            <div className="storeProductGrid">
              {items.map((item) => (
                <RecommendationCardView
                  key={item.productId}
                  onSaveChange={(saved) => {
                    if (!saved) {
                      setItems((current) =>
                        current.filter(({ productId }) => productId !== item.productId),
                      );
                    }
                  }}
                  recommendation={item.recommendation}
                  showSave
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
