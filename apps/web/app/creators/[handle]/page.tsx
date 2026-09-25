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
import { StorefrontHeader } from '../../_components/storefront-header';
import { CreatorStorefrontView } from '../../_components/creator-storefront';
import { StorefrontPhonePreview } from '../../_components/storefront-phone-preview';

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
  await searchParams;
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
    <div className="editorialPage storefrontPage">
      <StorefrontHeader creatorSession={creatorSession} workspace />
      <main>
        <StorefrontPhonePreview
          contentTargets={[
            ...storefront.brands.map(({ id, name }) => ({
              id,
              title: name,
              kind: 'brand',
            })),
            ...storefront.curatedSections
              .filter(({ brandId, kind }) => !brandId && kind !== 'page')
              .map(({ id, title }) => ({ id, title })),
          ]}
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
    </div>
  );
}

function UnavailableStorefront({ creatorSession }: { creatorSession: boolean }) {
  return (
    <div className="editorialPage storefrontPage">
      <StorefrontHeader creatorSession={creatorSession} workspace />
      <main>
        <section className="directoryHero">
          <p className="eyebrow">CREATOR STOREFRONT</p>
          <h1>This storefront is temporarily unavailable</h1>
          <p className="lede">The swavii API is not connected in this environment yet.</p>
          <Link className="button secondary" href="/creators">
            Browse creators
          </Link>
        </section>
      </main>
    </div>
  );
}
