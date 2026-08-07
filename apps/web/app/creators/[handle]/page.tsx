import type { CreatorStorefront, RecommendationCard } from '@vibeshub/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApiError, publicApiCollectionRequest, publicApiRequest } from '../../../lib/api';
import { RecommendationCardView } from '../../_components/recommendation-card';
import { SiteHeader } from '../../_components/site-header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  description: 'Authentic product recommendations from an approved Israeli creator.',
  title: 'Creator storefront',
};

interface CreatorStorefrontPageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ cursor?: string }>;
}

export default async function CreatorStorefrontPage({
  params,
  searchParams,
}: CreatorStorefrontPageProps) {
  const { handle } = await params;
  const filters = await searchParams;
  const query = new URLSearchParams({ limit: '12' });
  if (filters.cursor) query.set('cursor', filters.cursor);

  let storefront: CreatorStorefront;
  let recommendations: RecommendationCard[] = [];
  let nextCursor: string | null = null;
  try {
    const [creatorResponse, recommendationResponse] = await Promise.all([
      publicApiRequest<CreatorStorefront>(`/creators/${encodeURIComponent(handle)}`),
      publicApiCollectionRequest<RecommendationCard>(
        `/creators/${encodeURIComponent(handle)}/recommendations?${query.toString()}`,
      ),
    ]);
    storefront = creatorResponse;
    recommendations = recommendationResponse.data;
    nextCursor = recommendationResponse.page.nextCursor;
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) notFound();
    return <UnavailableStorefront />;
  }

  return (
    <main>
      <SiteHeader />
      <section className="storefrontHero">
        <div className="storefrontAvatar" aria-hidden="true">
          {initials(storefront.displayName)}
        </div>
        <div className="storefrontIdentity">
          <p className="eyebrow">CREATOR STOREFRONT</p>
          <div className="storefrontName">
            <h1>{storefront.displayName}</h1>
            {storefront.verificationStatus === 'verified' ? (
              <span className="verifiedBadge" aria-label="Verified creator">
                ✓
              </span>
            ) : null}
          </div>
          <p className="storefrontMeta">
            @{storefront.handle} · {storefront.primaryCategory.name} creator ·{' '}
            {compactNumber(storefront.followerCount)} followers
          </p>
          <p className="storefrontBio" dir="rtl" lang="he">
            {storefront.bio.value}
          </p>
          <div className="storefrontMetrics">
            <span>{storefront.recommendationCount} recommendations</span>
            <span>Verified by VibesHub</span>
          </div>
        </div>
      </section>

      <section className="storefrontProducts" aria-labelledby="storefront-products-title">
        <div className="directoryHeading">
          <div>
            <p className="eyebrow">RECOMMENDATIONS</p>
            <h2 id="storefront-products-title">Products I stand behind</h2>
          </div>
          <p>Image first · details below</p>
        </div>

        {recommendations.length === 0 ? (
          <div className="directoryState">
            <h3>No published recommendations yet</h3>
            <p>This creator is preparing their storefront. Check back soon.</p>
          </div>
        ) : (
          <div className="storeProductGrid">
            {recommendations.map((recommendation) => (
              <RecommendationCardView
                key={recommendation.id}
                recommendation={recommendation}
              />
            ))}
          </div>
        )}

        {nextCursor ? (
          <Link
            className="button secondary loadMore"
            href={`/creators/${encodeURIComponent(handle)}?cursor=${encodeURIComponent(nextCursor)}`}
          >
            Show more recommendations
          </Link>
        ) : null}
      </section>
    </main>
  );
}

function UnavailableStorefront() {
  return (
    <main>
      <SiteHeader />
      <section className="directoryHero">
        <p className="eyebrow">CREATOR STOREFRONT</p>
        <h1>This storefront is temporarily unavailable</h1>
        <p className="lede">The VibesHub API is not connected in this environment yet.</p>
        <Link className="button secondary" href="/creators">
          Browse creators
        </Link>
      </section>
    </main>
  );
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
