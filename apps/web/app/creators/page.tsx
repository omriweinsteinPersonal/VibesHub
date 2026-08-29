import type { CreatorCard } from '@vibeshub/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';

import { publicApiCollectionRequest } from '../../lib/api';
import { CreatorCardView } from '../_components/creator-card';
import { SiteFooter } from '../_components/site-footer';
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
  if (filters.cursor) query.set('cursor', filters.cursor);
  if (filters.q) query.set('q', filters.q);

  let creators: CreatorCard[] = [];
  let nextCursor: string | null = null;
  let unavailable = false;

  try {
    const creatorPage = await publicApiCollectionRequest<CreatorCard>(
      `/creators?${query.toString()}`,
    );
    creators = creatorPage.data;
    nextCursor = creatorPage.page.nextCursor;
  } catch {
    unavailable = true;
  }

  return (
    <div className="editorialPage">
      <SiteHeader />
      <section className="directoryHero">
        <p className="eyebrow">COMMUNITY</p>
        <h1>The creators behind the recommendations</h1>
        <p className="lede">
          Each storefront is run by one person with one point of view. Follow the ones
          whose taste matches yours.
        </p>

        <form className="directorySearch" action="/creators" method="get" role="search">
          <label htmlFor="creator-search">Search creators</label>
          <div>
            <Search aria-hidden="true" className="fieldSearchIcon" size={16} />
            <input
              defaultValue={filters.q}
              id="creator-search"
              name="q"
              placeholder="Search a creator by name, handle or category…"
              type="search"
            />
            <button className="button primary" type="submit">
              Search
            </button>
          </div>
        </form>
      </section>

      <section className="directoryContent" aria-labelledby="directory-title">
        <div className="directoryHeading">
          <div>
            <p className="eyebrow" id="directory-title">
              ON VIBESHUB
            </p>
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
      <SiteFooter />
    </div>
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
