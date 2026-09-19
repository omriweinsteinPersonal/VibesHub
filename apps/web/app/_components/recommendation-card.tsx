'use client';

import type { RecommendationCard, RecommendationCreator } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import { splitBilingualProductTitle } from '../../lib/bilingual-product-title';
import { merchantNameFromHostname } from '../../lib/merchant-name';
import { publicAssetUrl } from '../../lib/public-asset-url';
import { publicShopUrl } from '../../lib/public-shop-url';
import { RecommendationImpressionTracker } from './analytics-events';
import { SaveProductButton } from './engagement';

interface RecommendationCardViewProps {
  creator?: RecommendationCreator;
  creatorId?: string;
  onSaveChange?: (saved: boolean) => void;
  recommendation: RecommendationCard;
  showSave?: boolean;
}

export function RecommendationCardView({
  creator,
  creatorId,
  onSaveChange,
  recommendation,
  showSave = false,
}: RecommendationCardViewProps) {
  const attributedCreatorId = creatorId ?? creator?.id;
  const brand = merchantNameFromHostname(
    recommendation.merchantHostname,
    recommendation.brandName,
  );
  const title = splitBilingualProductTitle(recommendation.productName);

  return (
    <article className="storeProductCard">
      {attributedCreatorId ? (
        <RecommendationImpressionTracker
          creatorId={attributedCreatorId}
          productId={recommendation.productId}
          recommendationId={recommendation.id}
        />
      ) : null}
      <Link
        aria-label={`View details for ${recommendation.productName}`}
        className="storeCardHitArea"
        href={`/products/${recommendation.id}`}
      />
      <div className="storeProductImage">
        <Image
          alt={`${recommendation.productName} by ${brand}`}
          fill
          sizes="(max-width: 700px) 240px, (max-width: 1100px) 50vw, 25vw"
          src={publicAssetUrl(recommendation.imageUrl)}
          unoptimized
        />
      </div>
      <div className="storeProductDetails">
        <div className="storeProductTopline">
          <p className="productBrand">{brand}</p>
          {showSave ? (
            <div className="storeCardAction">
              <SaveProductButton
                onChange={onSaveChange}
                productId={recommendation.productId}
                recommendationId={recommendation.id}
              />
            </div>
          ) : null}
        </div>
        <h3 className={title ? 'bilingualProductTitle' : undefined} dir="auto">
          {title ? (
            <>
              <span dir="ltr" lang="en">{title.english}</span>
              <span dir="rtl" lang="he">{title.hebrew}</span>
            </>
          ) : recommendation.productName}
        </h3>
        <p className="storePrice" dir="rtl">{formatIls(recommendation.price.amountMinor)}</p>
        <footer>
          <span className="merchantDomain">{recommendation.merchantHostname}</span>
          <a
            className="button primary small"
            href={publicShopUrl(recommendation.shopUrl)}
            rel="nofollow sponsored noopener noreferrer"
            target="_blank"
          >
            Shop
            <ExternalLink aria-hidden="true" size={14} />
          </a>
        </footer>
      </div>
    </article>
  );
}

function formatIls(amountMinor: number): string {
  return new Intl.NumberFormat('he-IL', {
    currency: 'ILS',
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    style: 'currency',
  }).format(amountMinor / 100);
}
