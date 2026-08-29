'use client';

import type {
  CreatorStorefront,
  PublicDiscountCode,
  RecommendationCard,
} from '@vibeshub/contracts';
import Image from 'next/image';
import { useMemo, useRef, useState } from 'react';

import {
  CopyDiscountCodeButton,
  StorefrontViewTracker,
  TrackedInstagramLink,
} from './analytics-events';
import { EngagementProvider, FollowCreatorButton } from './engagement';
import { RecommendationCardView } from './recommendation-card';

export function CreatorStorefrontView({
  codes,
  recommendations,
  storefront,
}: {
  codes: PublicDiscountCode[];
  recommendations: RecommendationCard[];
  storefront: CreatorStorefront;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('he-IL');
    if (!term) return recommendations;
    return recommendations.filter((item) =>
      [item.productName, item.brandName, item.review.value, item.category.name].some(
        (value) => value.toLocaleLowerCase('he-IL').includes(term),
      ),
    );
  }, [query, recommendations]);
  const rows = useMemo(
    () => groupRecommendations(storefront, filtered),
    [filtered, storefront],
  );
  const instagram = storefront.socialLinks.find(
    ({ platform }) => platform === 'instagram',
  );

  return (
    <EngagementProvider
      creatorIds={[storefront.id]}
      productIds={recommendations.map(({ productId }) => productId)}
    >
      <StorefrontViewTracker creatorId={storefront.id} />
      <section className="referenceStorefrontHero">
        <div className="referenceStorefrontInner">
          <span className="referenceStorefrontAvatar">
            {storefront.avatarUrl ? (
              <Image
                alt={`${storefront.displayName} profile photo`}
                fill
                priority
                sizes="180px"
                src={storefront.avatarUrl}
                unoptimized
              />
            ) : (
              <b>{initials(storefront.displayName)}</b>
            )}
          </span>
          <div className="referenceStorefrontName">
            <div>
              <h1>{storefront.displayName}</h1>
              {storefront.verificationStatus === 'verified' ? (
                <span aria-label="Verified creator">✓</span>
              ) : null}
            </div>
            <p>
              {storefront.primaryCategory.name} <span>@{storefront.handle}</span>
            </p>
            <div className="referenceStorefrontActions">
              <FollowCreatorButton creatorId={storefront.id} />
              {instagram ? (
                <TrackedInstagramLink
                  className="button secondary"
                  creatorId={storefront.id}
                  href={instagram.url}
                >
                  Instagram ↗
                </TrackedInstagramLink>
              ) : null}
            </div>
          </div>
          <div className="referenceStorefrontBio">
            <small>{storefront.recommendationCount} recommendations</small>
            <p dir="rtl" lang="he">
              {storefront.bio.value}
            </p>
          </div>
        </div>
      </section>

      <section className="referenceStorefrontProducts">
        <header>
          <h2>Recommendations</h2>
          <label>
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search this store"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this store…"
              type="search"
              value={query}
            />
          </label>
        </header>
        {!rows.length ? (
          <div className="directoryState">
            <h3>No recommendations found</h3>
            <p>Try another product or brand name.</p>
          </div>
        ) : (
          rows.map((row) => (
            <StorefrontRow
              creatorId={storefront.id}
              key={row.key}
              recommendations={row.items}
              title={row.title}
            />
          ))
        )}
      </section>

      {codes.length ? (
        <section className="referenceStorefrontCodes">
          <h2>Brand discounts</h2>
          <div>
            {codes.map((code) => (
              <article key={code.id}>
                <p>{code.merchantName}</p>
                <h3>{code.code}</h3>
                {code.details ? (
                  <p dir="rtl" lang="he">
                    {code.details.value}
                  </p>
                ) : null}
                <CopyDiscountCodeButton
                  code={code.code}
                  creatorId={storefront.id}
                  discountCodeId={code.id}
                  recommendationId={null}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </EngagementProvider>
  );
}

function StorefrontRow({
  creatorId,
  recommendations,
  title,
}: {
  creatorId: string;
  recommendations: RecommendationCard[];
  title: string;
}) {
  const row = useRef<HTMLDivElement>(null);
  function scroll(direction: number) {
    row.current?.scrollBy({
      behavior: 'smooth',
      left: direction * Math.min(760, row.current.clientWidth * 0.8),
    });
  }
  return (
    <section className="referenceStorefrontRow">
      <header>
        <div>
          <h3>{title}</h3>
          <p>
            {recommendations.length} {recommendations.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <div>
          <button
            aria-label={`Previous ${title}`}
            onClick={() => scroll(-1)}
            type="button"
          >
            ‹
          </button>
          <button aria-label={`Next ${title}`} onClick={() => scroll(1)} type="button">
            ›
          </button>
        </div>
      </header>
      <div className="referenceStorefrontScroller" ref={row}>
        {recommendations.map((recommendation) => (
          <RecommendationCardView
            creatorId={creatorId}
            key={recommendation.id}
            recommendation={recommendation}
            showSave
          />
        ))}
      </div>
    </section>
  );
}

function groupRecommendations(
  storefront: CreatorStorefront,
  recommendations: RecommendationCard[],
) {
  const sections = storefront.storefrontSections ?? [];
  if (!sections.length)
    return recommendations.length
      ? [{ items: recommendations, key: 'all', title: 'More picks' }]
      : [];
  const used = new Set<string>();
  const rows = sections.flatMap((category) => {
    const items = recommendations.filter((item) => item.category.slug === category.slug);
    if (!items.length) return [];
    items.forEach(({ id }) => used.add(id));
    return [{ items, key: category.slug, title: category.name }];
  });
  const remaining = recommendations.filter(({ id }) => !used.has(id));
  if (remaining.length) rows.push({ items: remaining, key: 'more', title: 'More picks' });
  return rows;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
