import type {
  CategoryCard,
  DiscoveryRecommendationCard,
  DiscoverySort,
} from '@vibeshub/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Bookmark, Clock, Flame, Search } from 'lucide-react';

import { publicApiCollectionRequest } from '../../lib/api';
import { EngagementProvider } from '../_components/engagement';
import { RecommendationCardView } from '../_components/recommendation-card';
import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  description:
    'Discover products recommended by Israeli creators, filtered by category and popularity.',
  title: 'Discover',
};

interface DiscoverPageProps {
  searchParams: Promise<{
    category?: string;
    cursor?: string;
    q?: string;
    sort?: string;
  }>;
}

const sorts: ReadonlyArray<{ label: string; value: DiscoverySort }> = [
  { label: 'Trending', value: 'trending' },
  { label: 'Most saved', value: 'most-saved' },
  { label: 'Newest', value: 'newest' },
];

const sortIcons = {
  newest: Clock,
  'most-saved': Bookmark,
  trending: Flame,
} as const;

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const filters = await searchParams;
  const sort = normalizeSort(filters.sort);
  const searchQuery = normalizeSearch(filters.q);
  const activeFilters = { category: filters.category, q: searchQuery };
  const query = new URLSearchParams({ sort });
  if (filters.category) query.set('category', filters.category);
  if (filters.cursor) query.set('cursor', filters.cursor);
  if (searchQuery) query.set('q', searchQuery);

  let categories: CategoryCard[] = [];
  let recommendations: DiscoveryRecommendationCard[] = [];
  let nextCursor: string | null = null;
  let unavailable = false;

  try {
    const [categoryPage, recommendationPage] = await Promise.all([
      publicApiCollectionRequest<CategoryCard>('/categories'),
      publicApiCollectionRequest<DiscoveryRecommendationCard>(
        `/discover/recommendations?${query.toString()}`,
      ),
    ]);
    categories = categoryPage.data;
    recommendations = recommendationPage.data;
    nextCursor = recommendationPage.page.nextCursor;
  } catch {
    unavailable = true;
  }

  return (
    <div className="editorialPage">
      <SiteHeader />
      <section className="discoverHero">
        <p className="eyebrow">DISCOVER</p>
        <h1>Every recommendation in one place</h1>
        <p className="lede">
          Search a product, filter by category, and sort by what shoppers love most.
        </p>

        <form action="/discover" className="discoverSearch" method="get" role="search">
          {filters.category ? (
            <input name="category" type="hidden" value={filters.category} />
          ) : null}
          <input name="sort" type="hidden" value={sort} />
          <label htmlFor="product-search">Search products</label>
          <div>
            <Search aria-hidden="true" className="fieldSearchIcon" size={20} />
            <input
              defaultValue={filters.q}
              id="product-search"
              minLength={2}
              name="q"
              placeholder="Try 'Nike', 'serum' or a creator's name…"
              type="search"
            />
            <button className="button primary" type="submit">
              Search
            </button>
          </div>
        </form>
      </section>

      <section className="discoverControls" aria-label="Product discovery filters">
        <div className="filterRow">
          <span className="filterLabel">Categories</span>
          <div className="categoryFilters" aria-label="Filter products by category">
            {categories.map((category) => (
              <Link
                className={filters.category === category.slug ? 'active' : undefined}
                href={discoverUrl(activeFilters, {
                  category: filters.category === category.slug ? null : category.slug,
                  cursor: null,
                  sort,
                })}
                key={category.id}
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="discoverSortRow">
          <div className="sortFilters" aria-label="Sort products">
            {sorts.map((option) => {
              const Icon = sortIcons[option.value];
              return (
                <Link
                  aria-current={sort === option.value ? 'page' : undefined}
                  className={sort === option.value ? 'active' : undefined}
                  href={discoverUrl(activeFilters, {
                    cursor: null,
                    sort: option.value,
                  })}
                  key={option.value}
                >
                  <Icon aria-hidden="true" size={14} />
                  {option.label}
                </Link>
              );
            })}
          </div>
          <p className="resultCount">{recommendations.length} products</p>
        </div>
      </section>

      <section className="discoverProducts" aria-labelledby="discover-products-title">
        <h2 className="srOnly" id="discover-products-title">
          {searchQuery ? `Results for “${searchQuery}”` : sortLabel(sort)}
        </h2>

        {unavailable ? (
          <div className="directoryState" role="status">
            <h3>Product discovery is temporarily unavailable</h3>
            <p>Please try again in a moment.</p>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="directoryState">
            <h3>No recommendations match these filters yet</h3>
            <p>Try another category or search as more creator picks are published.</p>
          </div>
        ) : (
          <EngagementProvider productIds={recommendations.map((item) => item.productId)}>
            <div className="storeProductGrid">
              {recommendations.map((recommendation) => (
                <RecommendationCardView
                  creator={recommendation.creator}
                  key={recommendation.id}
                  recommendation={recommendation}
                  showSave
                />
              ))}
            </div>
          </EngagementProvider>
        )}

        {nextCursor ? (
          <Link
            className="button secondary loadMore"
            href={discoverUrl(activeFilters, { cursor: nextCursor, sort })}
          >
            Show more products
          </Link>
        ) : null}
      </section>
      <SiteFooter />
    </div>
  );
}

function normalizeSort(value: string | undefined): DiscoverySort {
  return value === 'most-saved' || value === 'newest' ? value : 'trending';
}

function normalizeSearch(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length >= 2 ? normalized : undefined;
}

function sortLabel(sort: DiscoverySort): string {
  return {
    newest: 'Newest recommendations',
    'most-saved': 'Most saved products',
    trending: 'Trending recommendations',
  }[sort];
}

function discoverUrl(
  current: { category?: string | undefined; q?: string | undefined },
  update: {
    category?: string | null;
    cursor?: string | null;
    sort: DiscoverySort;
  },
): string {
  const query = new URLSearchParams({ sort: update.sort });
  const category = update.category === undefined ? current.category : update.category;
  if (category) query.set('category', category);
  if (current.q) query.set('q', current.q);
  if (update.cursor) query.set('cursor', update.cursor);
  return `/discover?${query.toString()}`;
}
