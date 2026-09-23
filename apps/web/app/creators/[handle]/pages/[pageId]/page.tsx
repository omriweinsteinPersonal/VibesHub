import type { CreatorStorefront } from '@vibeshub/contracts';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { publicApiRequest } from '../../../../../lib/api';
import { hasCreatorSession } from '../../../../../lib/server-session';
import { loadStorefrontRecommendations } from '../../../../../lib/storefront-recommendations';
import { CreatorShellHeader } from '../../../../_components/creator-shell-header';
import { EngagementProvider } from '../../../../_components/engagement';
import { RecommendationCardView } from '../../../../_components/recommendation-card';
import { SiteFooter } from '../../../../_components/site-footer';
import { SiteHeader } from '../../../../_components/site-header';

export const dynamic = 'force-dynamic';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string; pageId: string }>;
}) {
  const { handle, pageId } = await params;
  const [storefront, recommendations, creatorSession] = await Promise.all([
    publicApiRequest<CreatorStorefront>(`/creators/${encodeURIComponent(handle)}`),
    loadStorefrontRecommendations(handle),
    hasCreatorSession(handle),
  ]);
  const page = storefront.curatedSections.find(
    ({ id, kind }) => id === pageId && (kind === 'page' || kind === 'collection'),
  );
  if (!page) notFound();
  const products = page.recommendationIds.flatMap(
    (id) => recommendations.find((item) => item.id === id) ?? [],
  );
  const collection = storefront.curatedSections.find(
    ({ id }) => id === page.parentCollectionId,
  );

  return (
    <div className="editorialPage">
      {creatorSession ? <CreatorShellHeader /> : <SiteHeader />}
      <main
        className="creatorProductPage"
        style={
          {
            '--sf-accent': storefront.theme.accentColor,
            '--sf-product': storefront.theme.productBackground,
            '--sf-text': storefront.theme.textColor,
          } as React.CSSProperties
        }
      >
        <Link
          className="creatorProductPageBack"
          href={`/creators/${encodeURIComponent(handle)}`}
        >
          <ChevronLeft aria-hidden="true" size={16} />
          Back
        </Link>
        <header>
          <p className="eyebrow">{collection?.title ?? storefront.displayName}</p>
          <h1>{page.title}</h1>
          {page.description ? <p>{page.description}</p> : null}
        </header>
        <EngagementProvider
          creatorIds={[storefront.id]}
          productIds={products.map(({ productId }) => productId)}
        >
          <div className="creatorProductPageGrid">
            {products.map((recommendation) => (
              <RecommendationCardView
                creatorId={storefront.id}
                key={recommendation.id}
                recommendation={recommendation}
              />
            ))}
          </div>
        </EngagementProvider>
      </main>
      <SiteFooter />
    </div>
  );
}
