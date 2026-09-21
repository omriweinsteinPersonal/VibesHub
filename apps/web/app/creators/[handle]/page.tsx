import type {
  CreatorStorefront,
  PublicDiscountCode,
  RecommendationCard,
} from '@vibeshub/contracts';
import type { Metadata } from 'next';
import { defaultStorefrontTheme } from '@vibeshub/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApiError, publicApiCollectionRequest, publicApiRequest } from '../../../lib/api';
import { loadStorefrontRecommendations } from '../../../lib/storefront-recommendations';
import { hasCreatorSession } from '../../../lib/server-session';
import { CreatorShellHeader } from '../../_components/creator-shell-header';
import { CreatorStorefrontView } from '../../_components/creator-storefront';
import { StorefrontPhonePreview } from '../../_components/storefront-phone-preview';
import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  description: 'Authentic product recommendations from an approved Israeli creator.',
  title: 'Creator storefront',
};

interface CreatorStorefrontPageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ mobilePreview?: string | string[] }>;
}

export default async function CreatorStorefrontPage({
  params,
  searchParams,
}: CreatorStorefrontPageProps) {
  const { handle } = await params;
  const previewOnly = (await searchParams).mobilePreview === '1';
  const creatorSession = await hasCreatorSession(handle);

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
      {previewOnly ? null : creatorSession ? <CreatorShellHeader /> : <SiteHeader />}
      <main>
        <StorefrontPhonePreview
          creatorId={storefront.id}
          editable={creatorSession}
          previewUrl={`/creators/${encodeURIComponent(handle)}?mobilePreview=1`}
          theme={storefront.theme ?? defaultStorefrontTheme}
          title={`${storefront.displayName} mobile storefront`}
        >
          <CreatorStorefrontView
            codes={discountCodes}
            editable={creatorSession}
            recommendations={recommendations}
            storefront={storefront}
          />
        </StorefrontPhonePreview>
      </main>
      {previewOnly ? null : <SiteFooter />}
    </div>
  );
}

function UnavailableStorefront({ creatorSession }: { creatorSession: boolean }) {
  return (
    <div className="editorialPage">
      {creatorSession ? <CreatorShellHeader /> : <SiteHeader />}
      <main>
        <section className="directoryHero">
          <p className="eyebrow">CREATOR STOREFRONT</p>
          <h1>This storefront is temporarily unavailable</h1>
          <p className="lede">The Swave API is not connected in this environment yet.</p>
          <Link className="button secondary" href="/creators">
            Browse creators
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
