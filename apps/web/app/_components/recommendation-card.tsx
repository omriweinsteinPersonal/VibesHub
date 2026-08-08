import type {
  DiscountCodeVerificationStatus,
  RecommendationCard,
  RecommendationCreator,
} from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';

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
  return (
    <article className="storeProductCard">
      {attributedCreatorId ? (
        <RecommendationImpressionTracker
          creatorId={attributedCreatorId}
          productId={recommendation.productId}
          recommendationId={recommendation.id}
        />
      ) : null}
      <div className="storeProductImage">
        <Image
          alt={`${recommendation.productName} by ${recommendation.brandName}`}
          fill
          sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
          src={recommendation.imageUrl}
          unoptimized
        />
        {recommendation.videoUrl ? (
          <StoryVideo
            creatorId={attributedCreatorId}
            posterUrl={recommendation.imageUrl}
            productId={recommendation.productId}
            productName={recommendation.productName}
            recommendationId={recommendation.id}
            videoUrl={recommendation.videoUrl}
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
        <p className="productBrand">{recommendation.brandName}</p>
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
              <span>CODE: {recommendation.discount.code}</span>
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
