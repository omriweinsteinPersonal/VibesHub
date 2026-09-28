import type { PublicRecommendationDetail } from '@vibeshub/contracts';
import { notFound } from 'next/navigation';

import { ApiError, publicApiRequest } from '../../../lib/api';
import { ProductDetailView } from '../../_components/product-detail';

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
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

  const collectionPath = `/${encodeURIComponent(recommendation.creator.handle)}/pages/`;
  const backTo = from?.startsWith(collectionPath) ? from : undefined;

  return (
    <div className="editorialPage">
      <main>
        <ProductDetailView
          {...(backTo ? { backTo } : {})}
          recommendation={recommendation}
        />
      </main>
    </div>
  );
}
