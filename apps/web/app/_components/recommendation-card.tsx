'use client';

import type { RecommendationCard, RecommendationCreator } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { splitBilingualProductTitle } from '../../lib/bilingual-product-title';
import { publicAssetUrl } from '../../lib/public-asset-url';
import { RecommendationImpressionTracker } from './analytics-events';
import { StoryVideo } from './story-video';

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
  const [imageShape, setImageShape] = useState<'standard' | 'wide'>('standard');
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
      <div className="storeProductImage" data-image-shape={imageShape}>
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
            setImageShape(ratio >= 1.6 ? 'wide' : 'standard');
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
          <h3 className={title ? 'bilingualProductTitle' : undefined} dir="auto">
            {title ? (
              <>
                <span dir="ltr" lang="en">
                  {title.english}
                </span>
                <span dir="rtl" lang="he">
                  {title.hebrew}
                </span>
              </>
            ) : (
              recommendation.productName
            )}
          </h3>
        </div>
        {recommendation.price.amountMinor > 0 ? (
          <p className="storePrice" dir={textDirection}>
            {formatIls(recommendation.price.amountMinor)}
          </p>
        ) : null}
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
