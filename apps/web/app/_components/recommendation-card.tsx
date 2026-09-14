'use client';

import type {
  DiscountCodeVerificationStatus,
  RecommendationCard,
  RecommendationCreator,
} from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ExternalLink, Tag } from 'lucide-react';
import { useRef, useState } from 'react';

import { merchantNameFromHostname } from '../../lib/merchant-name';
import { SaveProductButton } from './engagement';
import {
  CopyDiscountCodeButton,
  RecommendationImpressionTracker,
} from './analytics-events';
import { StoryVideo } from './story-video';

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
  const images = recommendation.images?.length
    ? recommendation.images
    : [
        {
          id: null,
          imageAssetId: recommendation.imageAssetId,
          position: 0,
          url: recommendation.imageUrl,
        },
      ];
  const [activeImage, setActiveImage] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const shownImage = images[activeImage] ?? images[0];

  function showAdjacentImage(direction: number) {
    setActiveImage((current) => (current + direction + images.length) % images.length);
  }

  return (
    <article className="storeProductCard">
      {attributedCreatorId ? (
        <RecommendationImpressionTracker
          creatorId={attributedCreatorId}
          productId={recommendation.productId}
          recommendationId={recommendation.id}
        />
      ) : null}
      <div
        className="storeProductImage"
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start || images.length < 2) return;
          const touch = event.changedTouches[0];
          if (!touch) return;
          const horizontalDistance = touch.clientX - start.x;
          const verticalDistance = touch.clientY - start.y;
          if (
            Math.abs(horizontalDistance) >= 40 &&
            Math.abs(horizontalDistance) > Math.abs(verticalDistance)
          ) {
            showAdjacentImage(horizontalDistance < 0 ? 1 : -1);
          }
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
      >
        <Image
          alt={`${recommendation.productName} by ${recommendation.brandName}`}
          fill
          sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
          src={shownImage?.url ?? recommendation.imageUrl}
          unoptimized
        />
        {images.length > 1 ? (
          <>
            <button
              aria-label="Previous product photo"
              className="productGalleryArrow previous"
              onClick={() => showAdjacentImage(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
            <button
              aria-label="Next product photo"
              className="productGalleryArrow next"
              onClick={() => showAdjacentImage(1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" size={18} />
            </button>
            <div
              className="productGalleryDots"
              aria-label={`${images.length} product photos`}
            >
              {images.map((image, index) => (
                <button
                  aria-label={`Show product photo ${index + 1}`}
                  aria-pressed={activeImage === index}
                  key={image.id ?? `${image.url}:${index}`}
                  onClick={() => setActiveImage(index)}
                  type="button"
                />
              ))}
            </div>
          </>
        ) : null}
        {recommendation.storyClips.length || recommendation.videoUrl ? (
          <StoryVideo
            creatorId={attributedCreatorId}
            posterUrl={shownImage?.url ?? recommendation.imageUrl}
            productId={recommendation.productId}
            productName={recommendation.productName}
            recommendationId={recommendation.id}
            videoUrls={
              recommendation.storyClips.length
                ? recommendation.storyClips.map(({ url }) => url)
                : recommendation.videoUrl
                  ? [recommendation.videoUrl]
                  : []
            }
          />
        ) : null}
        {recommendation.discount ? (
          <span className="storeCodeBadge">{recommendation.discount.code}</span>
        ) : null}
      </div>

      <div className="storeProductDetails">
        {showSave ? (
          <SaveProductButton
            onChange={onSaveChange}
            productId={recommendation.productId}
            recommendationId={recommendation.id}
          />
        ) : null}
        <p className="productBrand">
          {merchantNameFromHostname(
            recommendation.merchantHostname,
            recommendation.brandName,
          )}
        </p>
        <h3>{recommendation.productName}</h3>
        <p className="storePrice">{formatIls(recommendation.price.amountMinor)}</p>
        <p className="storeReview" dir="rtl" lang="he">
          {recommendation.review.value}
        </p>

        {creator ? (
          <Link className="discoveryCreator" href={`/creators/${creator.handle}`}>
            <span aria-hidden="true">{initials(creator.displayName)}</span>
            <small>
              Recommended by <strong>{creator.displayName}</strong>
              {creator.verificationStatus === 'verified' ? ' ✓' : ''}
            </small>
          </Link>
        ) : null}

        {recommendation.commercialRelationship !== 'organic' ? (
          <p className="commercialDisclosure">
            {relationshipLabel(recommendation.commercialRelationship)}
          </p>
        ) : null}

        <footer>
          {recommendation.discount ? (
            <div className="discountLine">
              <span>
                <Tag aria-hidden="true" size={14} />
                CODE: {recommendation.discount.code}
              </span>
              {recommendation.discount.label ? (
                <small>{recommendation.discount.label}</small>
              ) : null}
              {recommendation.discount.verificationStatus ? (
                <small>
                  {discountTruth(
                    recommendation.discount.verificationStatus,
                    recommendation.discount.expiresAt ?? null,
                  )}
                </small>
              ) : null}
              {recommendation.discount.id && attributedCreatorId ? (
                <CopyDiscountCodeButton
                  code={recommendation.discount.code}
                  creatorId={attributedCreatorId}
                  discountCodeId={recommendation.discount.id}
                  recommendationId={recommendation.id}
                />
              ) : null}
            </div>
          ) : (
            <span className="merchantDomain">{recommendation.merchantHostname}</span>
          )}
          <a
            className="button primary small"
            href={recommendation.shopUrl}
            rel="nofollow sponsored noopener noreferrer"
            target="_blank"
          >
            Shop now
            <ExternalLink aria-hidden="true" size={14} />
          </a>
        </footer>
      </div>
    </article>
  );
}

function discountTruth(
  status: DiscountCodeVerificationStatus,
  expiresAt: string | null,
): string {
  const verification =
    status === 'merchant_verified'
      ? 'Merchant verified'
      : status === 'staff_confirmed'
        ? 'VibesHub confirmed'
        : status === 'creator_confirmed'
          ? 'Creator confirmed'
          : status === 'stale'
            ? 'Needs reconfirmation'
            : 'Unverified';
  return expiresAt
    ? `${verification} · expires ${new Intl.DateTimeFormat('en-IL', {
        dateStyle: 'medium',
      }).format(new Date(expiresAt))}`
    : verification;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatIls(amountMinor: number): string {
  return new Intl.NumberFormat('he-IL', {
    currency: 'ILS',
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    style: 'currency',
  }).format(amountMinor / 100);
}

function relationshipLabel(
  relationship: RecommendationCard['commercialRelationship'],
): string {
  return {
    affiliate: 'Affiliate link',
    gifted: 'Product was gifted',
    organic: '',
    sponsored: 'Sponsored recommendation',
  }[relationship];
}
