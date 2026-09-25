import type { CreatorStorefront } from '@vibeshub/contracts';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { publicApiRequest } from '../../../../../lib/api';
import { hasCreatorSession } from '../../../../../lib/server-session';
import { loadStorefrontRecommendations } from '../../../../../lib/storefront-recommendations';
import { StorefrontHeader } from '../../../../_components/storefront-header';
import { RecommendationCardView } from '../../../../_components/recommendation-card';

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
      <StorefrontHeader creatorSession={creatorSession} />
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
          {collection ? <p className="eyebrow">{collection.title}</p> : null}
          <h1>{page.title}</h1>
          {page.description ? <p>{page.description}</p> : null}
        </header>
        <div className="creatorProductPageGrid">
          {products.map((recommendation) => (
            <RecommendationCardView
              creatorId={storefront.id}
              key={recommendation.id}
              recommendation={recommendation}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
