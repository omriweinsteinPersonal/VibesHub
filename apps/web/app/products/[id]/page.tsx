import type { PublicRecommendationDetail } from '@vibeshub/contracts';
import { notFound } from 'next/navigation';

import { ApiError, publicApiRequest } from '../../../lib/api';
import { hasCreatorSession } from '../../../lib/server-session';
import { StorefrontHeader } from '../../_components/storefront-header';
import { ProductDetailView } from '../../_components/product-detail';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let recommendation: PublicRecommendationDetail;
  try {
    recommendation = await publicApiRequest<PublicRecommendationDetail>(
      `/discover/recommendations/${encodeURIComponent(id)}`,
    );
  } catch (cause) {
    if (cause instanceof ApiError && (cause.status === 404 || cause.status === 422)) {
      notFound();
    }
    throw cause;
  }

  const creatorSession = await hasCreatorSession(recommendation.creator.handle);

  return (
    <div className="editorialPage">
      <StorefrontHeader creatorSession={creatorSession} />
      <main>
        <ProductDetailView recommendation={recommendation} />
      </main>
    </div>
  );
}
