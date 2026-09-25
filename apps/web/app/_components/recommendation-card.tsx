'use client';

import type { RecommendationCard, RecommendationCreator } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  isRedundantBrandTitleLine,
  splitBilingualProductTitle,
} from '../../lib/bilingual-product-title';
import { publicAssetUrl } from '../../lib/public-asset-url';
import { RecommendationImpressionTracker } from './analytics-events';
import { StoryVideo } from './story-video';

const measurementWithValue = /(\d+(?:[.,]\d+)?\s*(?:cm|g|gb|kg|l|mah|ml|mm|tb|v|w)\b)/giu;

interface RecommendationCardViewProps {
  creator?: RecommendationCreator;
  creatorId?: string;
  recommendation: RecommendationCard;
}

export function RecommendationCardView({
  creator,
  creatorId,
  recommendation,
}: RecommendationCardViewProps) {
  const [imageLayout, setImageLayout] = useState<'catalog' | 'editorial'>('catalog');
  const attributedCreatorId = creatorId ?? creator?.id;
  const clips = recommendation.storyClips?.length
    ? recommendation.storyClips.map(({ url }) => publicAssetUrl(url))
    : recommendation.videoUrl
      ? [publicAssetUrl(recommendation.videoUrl)]
      : [];
  const title = splitBilingualProductTitle(recommendation.productName);
  const textDirection = /^[^A-Za-z\u0590-\u05ff]*[\u0590-\u05ff]/u.test(
    recommendation.productName,
  )
    ? 'rtl'
    : 'ltr';
  const titleLines = title
    ? title.firstLanguage === 'he'
      ? [
          { direction: 'rtl' as const, language: 'he', text: title.hebrew },
          { direction: 'ltr' as const, language: 'en', text: title.english },
        ]
      : [
          { direction: 'ltr' as const, language: 'en', text: title.english },
          { direction: 'rtl' as const, language: 'he', text: title.hebrew },
        ]
    : null;
  const visibleTitleLines = titleLines?.filter(
    ({ text }) => !isRedundantBrandTitleLine(text, recommendation.brandName),
  );

  return (
    <article
      className="storeProductCard compactProductCard"
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
        href={`/products/${recommendation.id}`}
      />
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
      <div className="storeProductDetails" dir={textDirection}>
        <div className="compactProductHeading">
          <h3
            className={title ? 'bilingualProductTitle' : 'singleLanguageProductTitle'}
            dir={textDirection}
          >
            {visibleTitleLines?.length ? (
              visibleTitleLines.map((line, index) => (
                <span
                  className={
                    index === 0 ? 'productTitlePrimary' : 'productTitleSecondary'
                  }
                  dir={line.direction}
                  key={line.language}
                  lang={line.language}
                >
                  {line.text}
                </span>
              ))
            ) : titleLines ? null : (
              <span className="productTitlePrimary" dir={textDirection}>
                {isolateMeasurements(recommendation.productName)}
              </span>
            )}
          </h3>
        </div>
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
