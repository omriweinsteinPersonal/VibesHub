import type { CreatorCard } from '@vibeshub/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Search, Sparkles } from 'lucide-react';

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
      <section className="directoryHero creatorsAcquisitionHero">
        <p className="eyebrow">FOR CREATORS</p>
        <h1>Turn your recommendations into a storefront</h1>
        <p className="lede">
          Bring your trusted products, videos and discount codes together in one place
          your community can return to.
        </p>
        <div className="creatorsHeroActions">
          <Link className="button primary" href="/auth?mode=signup&role=creator">
            Join as a Creator
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
          <Link className="button secondary" href="#creator-community">
            Meet the community
          </Link>
        </div>
        <div className="creatorValuePoints" aria-label="Creator benefits">
          <div><Sparkles aria-hidden="true" size={16} />Your own storefront</div>
          <div><Sparkles aria-hidden="true" size={16} />Recommendations in one place</div>
          <div><Sparkles aria-hidden="true" size={16} />A direct path for your audience</div>
        </div>
      </section>

      <section
        className="directoryContent creatorsDirectory"
        id="creator-community"
        aria-labelledby="directory-title"
      >
        <div className="directoryHeading">
          <div>
            <p className="eyebrow">THE COMMUNITY</p>
            <h2 id="directory-title">Creators already on VibesHub</h2>
          </div>
          <p>{creators.length} shown</p>
        </div>
        <form className="directorySearch" action="/creators" method="get" role="search">
          <label htmlFor="creator-search">Search creators</label>
          <div>
            <Search aria-hidden="true" className="fieldSearchIcon" size={16} />
            <input
              defaultValue={filters.q}
              id="creator-search"
              name="q"
              placeholder="Search by name, handle or category"
              type="search"
            />
            <button className="button primary" type="submit">
              Search
            </button>
          </div>
        </form>

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
