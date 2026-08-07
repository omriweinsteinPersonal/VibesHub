import type {
  CategoryCard,
  DiscoveryRecommendationCard,
  DiscoverySort,
} from '@vibeshub/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { publicApiCollectionRequest } from '../../lib/api';
import { EngagementProvider } from '../_components/engagement';
import { RecommendationCardView } from '../_components/recommendation-card';
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
    <main>
      <SiteHeader />
      <section className="discoverHero">
        <p className="eyebrow">DISCOVER</p>
        <h1>Find products worth knowing about</h1>
        <p className="lede">
          Browse real recommendations from Israeli creators, then filter by what matters
          to you.
        </p>

        <form action="/discover" className="discoverSearch" method="get" role="search">
          {filters.category ? (
            <input name="category" type="hidden" value={filters.category} />
          ) : null}
          <input name="sort" type="hidden" value={sort} />
          <label htmlFor="product-search">Search products</label>
          <div>
            <input
              defaultValue={filters.q}
              id="product-search"
              minLength={2}
              name="q"
              placeholder="Search by product or brand"
              type="search"
            />
            <button className="button primary" type="submit">
              Search
            </button>
          </div>
        </form>
      </section>

      <section className="discoverControls" aria-label="Product discovery filters">
        <div className="categoryFilters" aria-label="Filter products by category">
          <Link
            className={!filters.category ? 'active' : undefined}
            href={discoverUrl(activeFilters, { category: null, cursor: null, sort })}
          >
            All
          </Link>
          {categories.map((category) => (
            <Link
              className={filters.category === category.slug ? 'active' : undefined}
              href={discoverUrl(activeFilters, {
                category: category.slug,
                cursor: null,
                sort,
              })}
              key={category.id}
            >
              {category.name}
            </Link>
          ))}
        </div>

        <div className="sortFilters" aria-label="Sort products">
          <span>Sort by</span>
          {sorts.map((option) => (
            <Link
              aria-current={sort === option.value ? 'page' : undefined}
              className={sort === option.value ? 'active' : undefined}
              href={discoverUrl(activeFilters, { cursor: null, sort: option.value })}
              key={option.value}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="discoverProducts" aria-labelledby="discover-products-title">
        <div className="directoryHeading">
          <div>
            <p className="eyebrow">CREATOR PICKS</p>
            <h2 id="discover-products-title">
              {searchQuery ? `Results for “${searchQuery}”` : sortLabel(sort)}
            </h2>
          </div>
          <p>{recommendations.length} shown</p>
        </div>

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
    </main>
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
