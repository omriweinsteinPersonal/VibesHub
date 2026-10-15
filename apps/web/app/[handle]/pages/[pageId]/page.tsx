import type { CreatorStorefront, PublicDiscountCode } from '@vibeshub/contracts';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';

import { publicApiCollectionRequest, publicApiRequest } from '../../../../lib/api';
import { loadStorefrontRecommendations } from '../../../../lib/storefront-recommendations';
import { RecommendationCardView } from '../../../_components/recommendation-card';

export const dynamic = 'force-dynamic';

export default async function StorefrontPageRoute({
  params,
}: {
  params: Promise<{ handle: string; pageId: string }>;
}) {
  const { handle, pageId } = await params;
  const [storefront, recommendations, discountResult] = await Promise.all([
    publicApiRequest<CreatorStorefront>(`/creators/${encodeURIComponent(handle)}`),
    loadStorefrontRecommendations(handle),
    publicApiCollectionRequest<PublicDiscountCode>(
      `/creators/${encodeURIComponent(handle)}/discount-codes`,
    ).catch(() => ({ data: [] })),
  ]);
  if (storefront.handle !== handle) {
    permanentRedirect(
      `/${encodeURIComponent(storefront.handle)}/pages/${encodeURIComponent(pageId)}`,
    );
  }
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
  const collectionBrand = storefront.brands.find(
    ({ brandId }) => brandId === page.brandId,
  );
  const collectionDiscount =
    page.kind === 'collection'
      ? (discountResult.data.find(
          (code) => code.scopeKind === 'collection' && code.scopeId === page.id,
        ) ??
        (collectionBrand
          ? discountResult.data.find(
              (code) => code.scopeKind === 'brand' && code.brandId === collectionBrand.id,
            )
          : undefined))
      : undefined;

  return (
    <div className="editorialPage">
      <main
        className="creatorProductPage"
        style={{
          '--sf-accent': storefront.theme.accentColor,
          '--sf-product': storefront.theme.productBackground,
          '--sf-text': storefront.theme.textColor,
        }}
      >
        <Link className="creatorProductPageBack" href={`/${encodeURIComponent(handle)}`}>
          <ChevronLeft aria-hidden="true" size={16} />
          Back
        </Link>
        <header>
          <div className="creatorProductPageHeaderMain">
            {collection ? <p className="eyebrow">{collection.title}</p> : null}
            <h1>{page.title}</h1>
            {page.description ? <p>{page.description}</p> : null}
          </div>
          {collectionDiscount ? (
            <aside className="creatorProductPageOffer" aria-label="Collection discount">
              <span>
                {collectionDiscount.discountPercent
                  ? `${collectionDiscount.discountPercent}% off`
                  : collectionDiscount.discountAmountMinor
                    ? `₪${collectionDiscount.discountAmountMinor / 100} off`
                    : collectionDiscount.label}
              </span>
              {collectionDiscount.code ? (
                <strong>{collectionDiscount.code}</strong>
              ) : null}
              {collectionDiscount.expiresAt ? (
                <small>
                  <span>Discount expires</span>
                  <b>{new Date(collectionDiscount.expiresAt).toLocaleDateString()}</b>
                </small>
              ) : null}
            </aside>
          ) : null}
        </header>
        <div className="creatorProductPageGrid">
          {products.map((recommendation) => (
            <RecommendationCardView
              backTo={`/${encodeURIComponent(handle)}/pages/${encodeURIComponent(pageId)}`}
              creatorId={storefront.id}
              key={recommendation.id}
              recommendation={recommendation}
              hideDiscount={page.kind === 'collection'}
              showPrice={false}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
