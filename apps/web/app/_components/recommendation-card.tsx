'use client';

import type { RecommendationCard, RecommendationCreator } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { publicAssetUrl } from '../../lib/public-asset-url';
import { hasRecommendationImage } from '../../lib/recommendation-image';
import { RecommendationImpressionTracker } from './analytics-events';
import { StoryVideo } from './story-video';

const measurementWithValue = /(\d+(?:[.,]\d+)?\s*(?:cm|g|gb|kg|l|mah|ml|mm|tb|v|w)\b)/giu;

interface RecommendationCardViewProps {
  backTo?: string;
  creator?: RecommendationCreator;
  creatorId?: string;
  hideDiscount?: boolean;
  recommendation: RecommendationCard;
  showBrand?: boolean;
  showPrice?: boolean;
}

export function RecommendationCardView({
  backTo,
  creator,
  creatorId,
  hideDiscount = false,
  recommendation,
  showBrand = false,
  showPrice = true,
}: RecommendationCardViewProps) {
  const [imageLayout, setImageLayout] = useState<'catalog' | 'editorial'>('catalog');
  const attributedCreatorId = creatorId ?? creator?.id;
  const clips = recommendation.storyClips?.length
    ? recommendation.storyClips.map(({ url }) => publicAssetUrl(url))
    : recommendation.videoUrl
      ? [publicAssetUrl(recommendation.videoUrl)]
      : [];
  const textDirection = /^[^A-Za-z\u0590-\u05ff]*[\u0590-\u05ff]/u.test(
    recommendation.productName,
  )
    ? 'rtl'
    : 'ltr';
  const isLinkCard = recommendation.contentKind === 'link';
  const hasImage = hasRecommendationImage(recommendation.imageUrl);
  if (isLinkCard) {
    return (
      <article
        className="storeLinkSection"
        data-link-backdrop={recommendation.review.value === 'Link card / backdrop'}
      >
        {attributedCreatorId ? (
          <RecommendationImpressionTracker
            creatorId={attributedCreatorId}
            productId={recommendation.productId}
            recommendationId={recommendation.id}
          />
        ) : null}
        <a
          aria-label={`Open ${recommendation.productName}`}
          href={recommendation.shopUrl}
          rel="noreferrer"
          target="_blank"
        >
          <span dir={textDirection}>{recommendation.productName}</span>
          <ExternalLink aria-hidden="true" size={16} />
        </a>
      </article>
    );
  }

  return (
    <article
      className="storeProductCard compactProductCard"
      data-content-kind={recommendation.contentKind}
      data-has-image={hasImage}
      data-show-price={showPrice}
      data-text-direction={textDirection}
    >
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
        href={
          backTo
            ? `/products/${recommendation.id}?from=${encodeURIComponent(backTo)}`
            : `/products/${recommendation.id}`
        }
      />
      {hasImage ? (
        <div className="storeProductImage" data-image-layout={imageLayout}>
          <Image
            alt=""
            aria-hidden="true"
            className="storeProductImageBackdrop"
            fill
            sizes="(max-width: 700px) 240px, (max-width: 1100px) 50vw, 25vw"
            src={publicAssetUrl(recommendation.imageUrl)}
            unoptimized
          />
          <Image
            alt={recommendation.productName}
            className="storeProductPrimaryImage"
            fill
            onLoad={({ currentTarget }) => {
              const ratio = currentTarget.naturalWidth / currentTarget.naturalHeight;
              const isWideWoltPhoto =
                ratio >= 1.6 && /(^|\.)wolt\.com$/i.test(recommendation.merchantHostname);
              setImageLayout(isWideWoltPhoto ? 'editorial' : 'catalog');
            }}
            sizes="(max-width: 700px) 240px, (max-width: 1100px) 50vw, 25vw"
            src={publicAssetUrl(recommendation.imageUrl)}
            unoptimized
          />
          {clips.length ? (
            <StoryVideo
              creatorId={attributedCreatorId}
              posterUrl={publicAssetUrl(recommendation.imageUrl)}
              productId={recommendation.productId}
              productName={recommendation.productName}
              recommendationId={recommendation.id}
              videoUrls={clips}
            />
          ) : null}
        </div>
      ) : null}
      <div className="storeProductDetails" dir={textDirection}>
        {showBrand ? (
          <p className="compactProductBrand" dir="auto">
            {recommendation.brandName}
          </p>
        ) : null}
        <div className="compactProductHeading">
          <h3 className="singleLanguageProductTitle" dir={textDirection}>
            <span className="productTitlePrimary" dir="auto">
              {isolateMeasurements(recommendation.productName)}
            </span>
          </h3>
        </div>
        {showPrice ? (
          <div className="storePriceRow">
            {recommendation.price.amountMinor > 0 ? (
              <p
                aria-label={`${formatPriceNumber(recommendation.price.amountMinor)} Israeli new shekels`}
                className="storePrice"
                dir="ltr"
              >
                <span aria-hidden="true">₪</span>
                <span>{formatPriceNumber(recommendation.price.amountMinor)}</span>
              </p>
            ) : null}
          </div>
        ) : null}
        {recommendation.discount && !hideDiscount ? (
          <div className="compactProductDiscount" dir="ltr">
            {recommendation.discount.code ? (
              <strong>{recommendation.discount.code}</strong>
            ) : null}
            {recommendation.discount.label ? (
              <span>{recommendation.discount.label}</span>
            ) : null}
            <small className={recommendation.discount.expiresAt ? '' : 'is-empty'}>
              <span>Discount expires</span>
              <strong>
                {recommendation.discount.expiresAt
                  ? new Intl.DateTimeFormat('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    }).format(new Date(recommendation.discount.expiresAt))
                  : '\u00a0'}
              </strong>
            </small>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function formatPriceNumber(amountMinor: number): string {
  return new Intl.NumberFormat('he-IL', {
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}

function isolateMeasurements(title: string) {
  return title.split(measurementWithValue).map((part, index) =>
    /^\d/u.test(part) ? (
      <bdi dir="ltr" key={`${part}-${index}`}>
        {part}
      </bdi>
    ) : (
      part
    ),
  );
}
