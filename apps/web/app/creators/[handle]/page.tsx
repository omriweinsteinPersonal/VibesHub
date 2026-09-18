import type {
  CreatorStorefront,
  PublicDiscountCode,
  RecommendationCard,
} from '@vibeshub/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApiError, publicApiCollectionRequest, publicApiRequest } from '../../../lib/api';
import { hasCreatorSession } from '../../../lib/server-session';
import { CreatorShellHeader } from '../../_components/creator-shell-header';
import { CreatorStorefrontView } from '../../_components/creator-storefront';
import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  description: 'Authentic product recommendations from an approved Israeli creator.',
  title: 'Creator storefront',
};

interface CreatorStorefrontPageProps {
  params: Promise<{ handle: string }>;
}

export default async function CreatorStorefrontPage({
  params,
}: CreatorStorefrontPageProps) {
  const { handle } = await params;
  const creatorSession = await hasCreatorSession();

  let storefront: CreatorStorefront;
  let recommendations: RecommendationCard[] = [];
  let discountCodes: PublicDiscountCode[] = [];
  try {
    const [creatorResponse, recommendationResponse, discountCodeResponse] =
      await Promise.all([
        publicApiRequest<CreatorStorefront>(`/creators/${encodeURIComponent(handle)}`),
        loadStorefrontRecommendations(handle),
        publicApiCollectionRequest<PublicDiscountCode>(
          `/creators/${encodeURIComponent(handle)}/discount-codes`,
        ),
      ]);
    storefront = creatorResponse;
    recommendations = recommendationResponse;
    discountCodes = discountCodeResponse.data;
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) notFound();
    return <UnavailableStorefront creatorSession={creatorSession} />;
  }

  return (
    <div className="editorialPage">
      {creatorSession ? <CreatorShellHeader /> : <SiteHeader />}
      <main>
        <CreatorStorefrontView
          codes={discountCodes}
          recommendations={recommendations}
          storefront={storefront}
        />
      </main>
      <SiteFooter />
    </div>
  );
}

async function loadStorefrontRecommendations(
  handle: string,
): Promise<RecommendationCard[]> {
  const items: RecommendationCard[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: '48' });
    if (cursor) query.set('cursor', cursor);
    const page = await publicApiCollectionRequest<RecommendationCard>(
      `/creators/${encodeURIComponent(handle)}/recommendations?${query.toString()}`,
    );
    items.push(...page.data);
    cursor = page.page.nextCursor;
  } while (cursor);
  return items;
}

function UnavailableStorefront({ creatorSession }: { creatorSession: boolean }) {
  return (
    <div className="editorialPage">
      {creatorSession ? <CreatorShellHeader /> : <SiteHeader />}
      <main>
        <section className="directoryHero">
          <p className="eyebrow">CREATOR STOREFRONT</p>
          <h1>This storefront is temporarily unavailable</h1>
          <p className="lede">
            The VibesHub API is not connected in this environment yet.
          </p>
          <Link className="button secondary" href="/creators">
            Browse creators
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
