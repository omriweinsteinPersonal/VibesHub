import type { CategoryCard, CreatorCard } from '@vibeshub/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { publicApiCollectionRequest } from '../../lib/api';
import { CreatorCardView } from '../_components/creator-card';
import { SiteHeader } from '../_components/site-header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  description: 'Discover approved Israeli creators and their authentic recommendations.',
  title: 'Creators',
};

interface CreatorsPageProps {
  searchParams: Promise<{ category?: string; cursor?: string; q?: string }>;
}

export default async function CreatorsPage({ searchParams }: CreatorsPageProps) {
  const filters = await searchParams;
  const query = new URLSearchParams();
  if (filters.category) query.set('category', filters.category);
  if (filters.cursor) query.set('cursor', filters.cursor);
  if (filters.q) query.set('q', filters.q);

  let categories: CategoryCard[] = [];
  let creators: CreatorCard[] = [];
  let nextCursor: string | null = null;
  let unavailable = false;

  try {
    const [categoryPage, creatorPage] = await Promise.all([
      publicApiCollectionRequest<CategoryCard>('/categories'),
      publicApiCollectionRequest<CreatorCard>(`/creators?${query.toString()}`),
    ]);
    categories = categoryPage.data;
    creators = creatorPage.data;
    nextCursor = creatorPage.page.nextCursor;
  } catch {
    unavailable = true;
  }

  return (
    <main>
      <SiteHeader />
      <section className="directoryHero">
        <p className="eyebrow">COMMUNITY</p>
        <h1>The creators behind the recommendations</h1>
        <p className="lede">
          Each storefront is run by one person with one point of view. Follow the creators
          whose taste matches yours.
        </p>

        <form className="directorySearch" action="/creators" method="get" role="search">
          {filters.category ? (
            <input type="hidden" name="category" value={filters.category} />
          ) : null}
          <label htmlFor="creator-search">Search creators</label>
          <div>
            <input
              defaultValue={filters.q}
              id="creator-search"
              name="q"
              placeholder="Search by name or handle"
              type="search"
            />
            <button className="button primary" type="submit">
              Search
            </button>
          </div>
        </form>
      </section>

      <section className="directoryContent" aria-labelledby="directory-title">
        <div className="categoryFilters" id="categories" aria-label="Filter by category">
          <Link className={!filters.category ? 'active' : undefined} href="/creators">
            All
          </Link>
          {categories.map((category) => (
            <Link
              className={filters.category === category.slug ? 'active' : undefined}
              href={`/creators?category=${category.slug}`}
              key={category.id}
            >
              {category.name}
            </Link>
          ))}
        </div>

        <div className="directoryHeading">
          <div>
            <p className="eyebrow">FEATURED</p>
            <h2 id="directory-title">
              {filters.category
                ? (categories.find((category) => category.slug === filters.category)
                    ?.name ?? 'Creators')
                : 'Approved creators'}
            </h2>
          </div>
          <p>{creators.length} shown</p>
        </div>

        {unavailable ? (
          <div className="directoryState" role="status">
            <h3>Creator discovery is temporarily unavailable</h3>
            <p>The storefront API is not connected in this environment yet.</p>
          </div>
        ) : creators.length === 0 ? (
          <div className="directoryState">
            <h3>No creators match this search yet</h3>
            <p>Try another category or come back as new storefronts are approved.</p>
          </div>
        ) : (
          <div className="creatorGrid">
            {creators.map((creator) => (
              <CreatorCardView creator={creator} key={creator.id} />
            ))}
          </div>
        )}

        {nextCursor ? (
          <Link
            className="button secondary loadMore"
            href={creatorPageUrl(filters, nextCursor)}
          >
            Show more creators
          </Link>
        ) : null}
      </section>
    </main>
  );
}

function creatorPageUrl(
  filters: { category?: string; q?: string },
  cursor: string,
): string {
  const query = new URLSearchParams({ cursor });
  if (filters.category) query.set('category', filters.category);
  if (filters.q) query.set('q', filters.q);
  return `/creators?${query.toString()}`;
}
