'use client';

import type { DiscoveryRecommendationCard, SavedProduct } from '@vibeshub/contracts';
import { ArrowRight, Heart } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  ApiError,
  apiCollectionRequest,
  publicApiCollectionRequest,
} from '../../../lib/api';
import { EngagementProvider } from '../../_components/engagement';
import { RecommendationCardView } from '../../_components/recommendation-card';
import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';

export default function SavedProductsPage() {
  const router = useRouter();
  const [items, setItems] = useState<SavedProduct[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [suggestionsResult, setSuggestionsResult] = useState<{
    items: DiscoveryRecommendationCard[];
    requestKey: string | null;
  }>({ items: [], requestKey: null });

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt)),
    [items],
  );
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, { name: string; items: SavedProduct[] }>();
    for (const item of sortedItems) {
      const { name, slug } = item.recommendation.category;
      const group = groups.get(slug) ?? { name, items: [] };
      group.items.push(item);
      groups.set(slug, group);
    }
    return [...groups.entries()].map(([slug, group]) => ({ slug, ...group }));
  }, [sortedItems]);
  const recommendationKey = categoryGroups
    .slice(0, 4)
    .map(({ slug }) => slug)
    .join(',');
  const savedProductIdsKey = items.map(({ productId }) => productId).join(',');
  const suggestionsRequestKey = `${recommendationKey}|${savedProductIdsKey}`;
  const suggestionsLoading = suggestionsResult.requestKey !== suggestionsRequestKey;
  const suggestions = suggestionsLoading ? [] : suggestionsResult.items;

  useEffect(() => {
    void loadPage();
    // The first collection request should only run when this page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    const categorySlugs = recommendationKey ? recommendationKey.split(',') : [];
    const queries = categorySlugs.length > 0 ? categorySlugs : [null];
    const savedIds = new Set(savedProductIdsKey ? savedProductIdsKey.split(',') : []);
    const requestKey = `${recommendationKey}|${savedProductIdsKey}`;

    void Promise.all(
      queries.map((category) => {
        const query = new URLSearchParams({ limit: '8', sort: 'trending' });
        if (category) query.set('category', category);
        return publicApiCollectionRequest<DiscoveryRecommendationCard>(
          `/discover/recommendations?${query.toString()}`,
        );
      }),
    )
      .then((pages) => {
        if (!active) return;
        const unique = new Map<string, DiscoveryRecommendationCard>();
        for (const recommendation of pages.flatMap(({ data }) => data)) {
          if (!savedIds.has(recommendation.productId)) {
            unique.set(recommendation.productId, recommendation);
          }
        }
        setSuggestionsResult({
          items: [...unique.values()].slice(0, 12),
          requestKey,
        });
      })
      .catch(() => {
        if (active) setSuggestionsResult({ items: [], requestKey });
      });

    return () => {
      active = false;
    };
  }, [recommendationKey, savedProductIdsKey]);

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
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace('/login?next=%2Faccount%2Fsaved');
        return;
      }
      setError(cause instanceof Error ? cause.message : 'Could not load saved products.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="editorialPage savedProductsPage">
      <SiteHeader />
      <section className="savedProductsHero">
        <div>
          <p className="eyebrow">YOUR VIBESHUB</p>
          <h1>My List</h1>
          <p className="lede">
            Your saved recommendations, offers and products in one place.
          </p>
        </div>
        <div className="savedProductsCount" aria-live="polite">
          <Heart aria-hidden="true" />
          <span className="savedProductsCountCopy">
            <strong>{items.length}</strong>
            <span>{items.length === 1 ? 'saved item' : 'saved items'}</span>
          </span>
        </div>
      </section>

      <section className="savedProductsCollection" aria-label="Saved products">
        {error ? <p className="formError">{error}</p> : null}
        {loading && items.length === 0 ? (
          <div className="savedProductsLoading" role="status">
            Loading your list...
          </div>
        ) : null}
        {!loading && items.length === 0 && !error ? (
          <div className="savedProductsEmpty">
            <Heart aria-hidden="true" />
            <p className="eyebrow">YOUR LIST IS READY</p>
            <h2>Save what you want to find again</h2>
            <p>Tap Save on any recommendation and it will appear here.</p>
            <Link className="button primary" href="/discover">
              Discover products
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        ) : null}
        {items.length > 0 ? (
          <>
            <div className="savedProductsHeading">
              <div>
                <p className="eyebrow">SAVED FOR LATER</p>
                <h2>Your collection</h2>
              </div>
              <Link href="/discover">
                Keep discovering <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </div>
            <EngagementProvider productIds={items.map(({ productId }) => productId)}>
              <div className="savedCategoryList">
                {categoryGroups.map((group) => (
                  <section className="savedCategorySection" key={group.slug}>
                    <div className="savedCategoryTitle">
                      <h3>{group.name}</h3>
                      <span>{group.items.length}</span>
                    </div>
                    <div className="savedProductRail">
                      {group.items.map((item) => (
                        <RecommendationCardView
                          key={item.productId}
                          onSaveChange={(saved) => {
                            if (!saved) {
                              setItems((current) =>
                                current.filter(
                                  ({ productId }) => productId !== item.productId,
                                ),
                              );
                            }
                          }}
                          recommendation={item.recommendation}
                          showSave
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </EngagementProvider>
          </>
        ) : null}
        {nextCursor ? (
          <button
            className="button secondary loadMore"
            disabled={loading}
            type="button"
            onClick={() => void loadPage(nextCursor)}
          >
            {loading ? 'Loading...' : 'Load more'}
          </button>
        ) : null}

        {!suggestionsLoading && suggestions.length > 0 ? (
          <section className="savedSuggestions" aria-labelledby="saved-suggestions-title">
            <div className="savedSuggestionsHeading">
              <p className="eyebrow">CURATED FOR YOU</p>
              <h2 id="saved-suggestions-title">You Might Also Like</h2>
              <p>Trending picks from the categories you return to most.</p>
            </div>
            <EngagementProvider
              productIds={suggestions.map(({ productId }) => productId)}
            >
              <div className="savedProductRail">
                {suggestions.map((recommendation) => (
                  <RecommendationCardView
                    creator={recommendation.creator}
                    key={recommendation.id}
                    recommendation={recommendation}
                    showSave
                  />
                ))}
              </div>
            </EngagementProvider>
          </section>
        ) : null}
      </section>
      <SiteFooter />
    </main>
  );
}
