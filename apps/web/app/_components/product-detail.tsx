'use client';

import type { PublicRecommendationDetail } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { Camera, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useState } from 'react';

import { merchantNameFromHostname } from '../../lib/merchant-name';
import { publicAssetUrl } from '../../lib/public-asset-url';
import { publicShopUrl } from '../../lib/public-shop-url';
import { CopyDiscountCodeButton } from './analytics-events';
import { StoryVideo } from './story-video';

export function ProductDetailView({
  recommendation,
}: {
  recommendation: PublicRecommendationDetail;
}) {
  const [activeImage, setActiveImage] = useState(0);
  const images = recommendation.images?.length
    ? recommendation.images
    : [{ id: null, url: recommendation.imageUrl }];
  const shownImage = images[activeImage] ?? images[0]!;
  const textDirection = /^[^A-Za-z\u0590-\u05ff]*[\u0590-\u05ff]/u.test(
    recommendation.productName,
  ) ? 'rtl' : 'ltr';
  const brand = merchantNameFromHostname(
    recommendation.merchantHostname,
    recommendation.brandName,
  );
  const clips = recommendation.storyClips.length
    ? recommendation.storyClips.map(({ url }) => publicAssetUrl(url))
    : recommendation.videoUrl
      ? [recommendation.videoUrl]
      : [];

  function moveImage(direction: number) {
    setActiveImage((current) => (current + direction + images.length) % images.length);
  }

  return (
    <article className="productDetailPage">
      <nav aria-label="Back to storefront" className="productDetailBreadcrumb">
        <Link
          className="productDetailBack"
          href={`/creators/${encodeURIComponent(recommendation.creator.handle)}`}
        >
          <ChevronLeft aria-hidden="true" size={16} />
          Back
        </Link>
      </nav>

      <div className="productDetailLayout">
        <div className="productDetailGallery">
          <div className="productDetailMedia">
            <Image
              alt={`${recommendation.productName} by ${brand}, photo ${activeImage + 1}`}
              fill
              priority
              sizes="(max-width: 480px) calc(100vw - 32px), 328px"
              src={publicAssetUrl(shownImage.url)}
              unoptimized
            />
            {clips.length ? (
              <StoryVideo
                creatorId={recommendation.creator.id}
                posterUrl={publicAssetUrl(recommendation.imageUrl)}
                productId={recommendation.productId}
                productName={recommendation.productName}
                recommendationId={recommendation.id}
                videoUrls={clips}
              />
            ) : null}
            {images.length > 1 ? (
              <>
                <button
                  aria-label="Previous photo"
                  className="productDetailGalleryArrow previous"
                  onClick={() => moveImage(-1)}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" size={20} />
                </button>
                <button
                  aria-label="Next photo"
                  className="productDetailGalleryArrow next"
                  onClick={() => moveImage(1)}
                  type="button"
                >
                  <ChevronRight aria-hidden="true" size={20} />
                </button>
              </>
            ) : null}
          </div>
          {images.length > 1 ? (
            <div aria-label="Product photos" className="productDetailThumbnails">
              {images.map((image, index) => (
                <button
                  aria-label={`View photo ${index + 1}`}
                  aria-pressed={activeImage === index}
                  key={image.id ?? `${image.url}:${index}`}
                  onClick={() => setActiveImage(index)}
                  type="button"
                >
                  <Image
                    alt=""
                    fill
                    sizes="72px"
                    src={publicAssetUrl(image.url)}
                    unoptimized
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="productDetailInformation">
          <h1 dir={textDirection} style={{ textAlign: 'start' }}>{recommendation.productName}</h1>
          {recommendation.price.amountMinor > 0 ? (
            <p className="productDetailPrice" dir={textDirection} style={{ textAlign: 'start' }}>
              {new Intl.NumberFormat('he-IL', {
                currency: 'ILS',
                maximumFractionDigits:
                  recommendation.price.amountMinor % 100 === 0 ? 0 : 2,
                style: 'currency',
              }).format(recommendation.price.amountMinor / 100)}
            </p>
          ) : null}

          <div className="productDetailActions">
            <a
              className="button primary"
              href={publicShopUrl(recommendation.shopUrl)}
              rel="nofollow sponsored noopener noreferrer"
              target="_blank"
            >
              Shop at {brand}
              <ExternalLink aria-hidden="true" size={17} />
            </a>
          </div>

          {recommendation.discount ? (
            <div className="productDetailDiscount">
              <div>
                <small>DISCOUNT CODE</small>
                <strong>{recommendation.discount.code}</strong>
                {recommendation.discount.label ? (
                  <span>{recommendation.discount.label}</span>
                ) : null}
              </div>
              {recommendation.discount.id ? (
                <CopyDiscountCodeButton
                  code={recommendation.discount.code}
                  creatorId={recommendation.creator.id}
                  discountCodeId={recommendation.discount.id}
                  recommendationId={recommendation.id}
                />
              ) : null}
            </div>
          ) : null}

          {recommendation.review.value !== 'לא צורפה ביקורת' ? (
            <section className="productDetailDescription">
              <h2>About this product</h2>
              <p
                dir={recommendation.review.direction}
                lang={recommendation.review.language}
              >
                {recommendation.review.value}
              </p>
            </section>
          ) : null}

          {clips.length || recommendation.instagramStoryUrl ? (
            <section className="productDetailStories">
              <h2>Creator stories</h2>
              <div>
                {clips.length ? (
                  <StoryVideo
                    creatorId={recommendation.creator.id}
                    posterUrl={publicAssetUrl(recommendation.imageUrl)}
                    productId={recommendation.productId}
                    productName={recommendation.productName}
                    recommendationId={recommendation.id}
                    triggerLabel={`Watch ${clips.length === 1 ? 'story' : `${clips.length} stories`}`}
                    videoUrls={clips}
                  />
                ) : null}
                {recommendation.instagramStoryUrl ? (
                  <a
                    className="button secondary"
                    href={recommendation.instagramStoryUrl}
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                  >
                    <Camera aria-hidden="true" size={16} />
                    View on Instagram
                    <ExternalLink aria-hidden="true" size={14} />
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </article>
  );
}
