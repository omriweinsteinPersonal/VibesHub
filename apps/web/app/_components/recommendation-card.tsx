import type { RecommendationCard } from '@vibeshub/contracts';
import Image from 'next/image';

interface RecommendationCardViewProps {
  recommendation: RecommendationCard;
}

export function RecommendationCardView({ recommendation }: RecommendationCardViewProps) {
  return (
    <article className="storeProductCard">
      <div className="storeProductImage">
        <Image
          alt={`${recommendation.productName} by ${recommendation.brandName}`}
          fill
          sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
          src={recommendation.imageUrl}
          unoptimized
        />
        {recommendation.videoUrl ? (
          <a
            aria-label={`Watch video preview for ${recommendation.productName}`}
            className="storyPreview"
            href={recommendation.videoUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span aria-hidden="true">▶</span>
            Video
          </a>
        ) : null}
        {recommendation.discount ? (
          <span className="storeCodeBadge">{recommendation.discount.code}</span>
        ) : null}
      </div>

      <div className="storeProductDetails">
        <p className="productBrand">{recommendation.brandName}</p>
        <h3>{recommendation.productName}</h3>
        <p className="storePrice">{formatIls(recommendation.price.amountMinor)}</p>
        <p className="storeReview" dir="rtl" lang="he">
          {recommendation.review.value}
        </p>

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
