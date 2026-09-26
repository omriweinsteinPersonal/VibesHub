import type {
  CreatorStorefront,
  PublicDiscountCode,
  RecommendationCard,
} from '@vibeshub/contracts';
import { defaultStorefrontTheme } from '@vibeshub/contracts';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';

import { ApiError, publicApiCollectionRequest, publicApiRequest } from '../../lib/api';
import { loadStorefrontRecommendations } from '../../lib/storefront-recommendations';
import { hasCreatorSession } from '../../lib/server-session';
import { CreatorStorefrontView } from './creator-storefront';
import { StorefrontHeader } from './storefront-header';
import { StorefrontPhonePreview } from './storefront-phone-preview';

export async function PublicStorefrontPage({ handle }: { handle: string }) {
  return <StorefrontPage handle={handle} mode="public" />;
}

export async function CreatorStorefrontEditorPage({ handle }: { handle: string }) {
  return <StorefrontPage handle={handle} mode="editor" />;
}

async function StorefrontPage({
  handle,
  mode,
}: {
  handle: string;
  mode: 'editor' | 'public';
}) {
  const creatorSession = mode === 'editor' && (await hasCreatorSession(handle));

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

  if (storefront.handle !== handle) {
    permanentRedirect(
      mode === 'editor'
        ? `/creator/${encodeURIComponent(storefront.handle)}`
        : `/${encodeURIComponent(storefront.handle)}`,
    );
  }

  if (mode === 'editor' && !creatorSession) {
    permanentRedirect(`/${encodeURIComponent(storefront.handle)}`);
  }

  if (mode === 'public') {
    return (
      <div className="editorialPage storefrontPage">
        <StorefrontHeader creatorSession={false} />
        <main>
          <CreatorStorefrontView
            codes={discountCodes}
            editable={false}
            recommendations={recommendations}
            storefront={storefront}
          />
        </main>
      </div>
    );
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
          editable
          previewUrl={`/${encodeURIComponent(handle)}?mobilePreview=1`}
          theme={storefront.theme ?? defaultStorefrontTheme}
          title={`${storefront.displayName} mobile storefront`}
        >
          <CreatorStorefrontView
            codes={discountCodes}
            editable
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
          <p className="lede">Please try again in a moment.</p>
          <Link className="button secondary" href="/creators">
            Browse creators
          </Link>
        </section>
      </main>
    </div>
  );
}
