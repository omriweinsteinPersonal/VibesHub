import type { PublicRecommendationDetail } from '@vibeshub/contracts';
import { notFound } from 'next/navigation';

import { ApiError, publicApiRequest } from '../../../lib/api';
import { EngagementProvider } from '../../_components/engagement';
import { ProductDetailView } from '../../_components/product-detail';
import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';

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

  return (
    <div className="editorialPage">
      <SiteHeader />
      <main>
        <EngagementProvider
          creatorIds={[recommendation.creator.id]}
          productIds={[recommendation.productId]}
        >
          <ProductDetailView recommendation={recommendation} />
        </EngagementProvider>
      </main>
      <SiteFooter />
    </div>
  );
}
