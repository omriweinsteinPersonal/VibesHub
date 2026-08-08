import { describe, expect, it } from 'vitest';

import {
  creatorAnalyticsDashboardSchema,
  creatorRecommendationInputSchema,
  creatorRecommendationMoveInputSchema,
  creatorCardSchema,
  creatorProfilePatchSchema,
  creatorProfileSettingsSchema,
  creatorApplicationInputSchema,
  creatorDirectoryQuerySchema,
  creatorDiscountCodeInputSchema,
  discoveryRecommendationQuerySchema,
  directionalTextSchema,
  engagementStateInputSchema,
  engagementListQuerySchema,
  moneySchema,
  merchantDomainApprovalInputSchema,
  merchantDomainQueueQuerySchema,
  merchantDomainReasonInputSchema,
  globalSearchQuerySchema,
  recommendationCardSchema,
  recommendationImageUploadInputSchema,
} from './index.js';

describe('shared API contracts', () => {
  it('accepts an ILS amount represented in minor units', () => {
    expect(moneySchema.parse({ amountMinor: 12_000, currency: 'ILS' })).toEqual({
      amountMinor: 12_000,
      currency: 'ILS',
    });
  });

  it('keeps Hebrew direction explicit', () => {
    expect(
      directionalTextSchema.parse({ direction: 'rtl', language: 'he', value: 'מומלץ' }),
    ).toMatchObject({ direction: 'rtl', language: 'he' });
  });

  it('normalizes creator handles and rejects insecure social links', () => {
    expect(
      creatorApplicationInputSchema.parse({
        requestedHandle: ' Noa_Levi ',
        socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/noa' }],
      }).requestedHandle,
    ).toBe('noa_levi');

    expect(() =>
      creatorApplicationInputSchema.parse({
        socialLinks: [{ platform: 'website', url: 'http://example.com' }],
      }),
    ).toThrow();
  });

  it('normalizes bounded creator directory filters', () => {
    expect(
      creatorDirectoryQuerySchema.parse({
        category: ' Beauty ',
        limit: '24',
        q: ' NOA ',
      }),
    ).toEqual({ category: 'beauty', limit: 24, q: 'noa' });

    expect(() => creatorDirectoryQuerySchema.parse({ limit: '100' })).toThrow();
  });

  it('keeps Hebrew creator copy directional and public fields explicit', () => {
    expect(
      creatorCardSchema.parse({
        avatarUrl: null,
        bio: { direction: 'rtl', language: 'he', value: 'המלצות אמיתיות' },
        displayName: 'Noa Levi',
        followerCount: 124_000,
        handle: 'noa-levi',
        id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
        primaryCategory: { name: 'Beauty', slug: 'beauty' },
        recommendationCount: 0,
        verificationStatus: 'verified',
      }).verificationStatus,
    ).toBe('verified');
  });

  it('validates creator profile settings and unique social platforms', () => {
    expect(
      creatorProfileSettingsSchema.parse({
        avatar: null,
        bioHe: 'המלצות אמיתיות על טיפוח ויופי',
        displayName: 'Noa Levi',
        handle: 'noa-levi',
        id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
        primaryCategory: {
          id: '01989f72-07e4-7f32-9b42-1ba55d4ca011',
          name: 'Beauty',
          slug: 'beauty',
        },
        socialLinks: [],
        version: 1,
      }).handle,
    ).toBe('noa-levi');

    expect(() =>
      creatorProfilePatchSchema.parse({
        socialLinks: [
          { platform: 'instagram', url: 'https://instagram.com/noa' },
          { platform: 'instagram', url: 'https://instagram.com/noa-beauty' },
        ],
      }),
    ).toThrow();
  });

  it('requires HTTPS commerce links and a Hebrew creator review', () => {
    expect(
      creatorRecommendationInputSchema.parse({
        brandName: 'Rare Beauty',
        categoryId: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
        imageUrl: 'https://images.example.com/blush.jpg',
        priceAmountMinor: 12_000,
        productName: 'Soft Pinch Liquid Blush',
        productUrl: 'https://shop.example.com/blush',
        reviewHe: 'המוצר האהוב עליי למראה טבעי וזוהר',
      }).commercialRelationship,
    ).toBe('organic');

    expect(() =>
      creatorRecommendationInputSchema.parse({
        brandName: 'Rare Beauty',
        categoryId: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
        imageUrl: 'http://images.example.com/blush.jpg',
        priceAmountMinor: 12_000,
        productName: 'Soft Pinch Liquid Blush',
        productUrl: 'https://shop.example.com/blush',
        reviewHe: 'A lovely product',
      }),
    ).toThrow();
  });

  it('accepts one owned image asset and rejects oversized uploads', () => {
    expect(
      creatorRecommendationInputSchema.parse({
        brandName: 'Rare Beauty',
        categoryId: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
        imageAssetId: '01989f72-07e4-7f32-9b42-1ba55d4ca011',
        priceAmountMinor: 12_000,
        productName: 'Soft Pinch Liquid Blush',
        productUrl: 'https://shop.example.com/blush',
        reviewHe: 'המוצר האהוב עליי למראה טבעי וזוהר',
      }).imageAssetId,
    ).toBe('01989f72-07e4-7f32-9b42-1ba55d4ca011');

    expect(() =>
      creatorRecommendationInputSchema.parse({
        brandName: 'Rare Beauty',
        categoryId: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
        imageAssetId: '01989f72-07e4-7f32-9b42-1ba55d4ca011',
        imageUrl: 'https://images.example.com/blush.jpg',
        priceAmountMinor: 12_000,
        productName: 'Soft Pinch Liquid Blush',
        productUrl: 'https://shop.example.com/blush',
        reviewHe: 'המוצר האהוב עליי למראה טבעי וזוהר',
      }),
    ).toThrow();

    expect(() =>
      recommendationImageUploadInputSchema.parse({
        contentType: 'image/jpeg',
        fileSizeBytes: 5 * 1_024 * 1_024 + 1,
      }),
    ).toThrow();
  });

  it('allows only one bounded storefront move direction', () => {
    expect(creatorRecommendationMoveInputSchema.parse({ direction: 'up' })).toEqual({
      direction: 'up',
    });
    expect(() =>
      creatorRecommendationMoveInputSchema.parse({ direction: 'first' }),
    ).toThrow();
    expect(() =>
      creatorRecommendationMoveInputSchema.parse({ direction: 'down', id: 'extra' }),
    ).toThrow();
  });

  it('normalizes discount codes and enforces Hebrew details and validity windows', () => {
    expect(
      creatorDiscountCodeInputSchema.parse({
        code: ' noa10 ',
        detailsHe: 'עשרה אחוזי הנחה באתר',
        expiresAt: '2026-09-01T00:00:00.000Z',
        label: '10% off',
        merchantUrl: 'https://shop.example.com',
        startsAt: '2026-08-01T00:00:00.000Z',
      }).code,
    ).toBe('NOA10');

    expect(() =>
      creatorDiscountCodeInputSchema.parse({
        code: 'NOA 10',
        detailsHe: '10% off',
        expiresAt: '2026-08-01T00:00:00.000Z',
        label: null,
        merchantUrl: 'http://shop.example.com',
        startsAt: '2026-09-01T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('keeps the public recommendation card image-first contract explicit', () => {
    expect(
      recommendationCardSchema.parse({
        brandName: 'Rare Beauty',
        category: { name: 'Beauty', slug: 'beauty' },
        commercialRelationship: 'affiliate',
        createdAt: '2026-08-07T10:00:00.000Z',
        discount: { code: 'NOA10', id: null, label: '10% off' },
        id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
        imageAssetId: null,
        imageUrl: 'https://images.example.com/blush.jpg',
        lifecycle: 'published',
        merchantHostname: 'shop.example.com',
        price: { amountMinor: 12_000, currency: 'ILS' },
        productId: '01989f72-07e4-7f32-9b42-1ba55d4ca012',
        productName: 'Soft Pinch Liquid Blush',
        review: {
          direction: 'rtl',
          language: 'he',
          value: 'המוצר האהוב עליי למראה טבעי וזוהר',
        },
        shopUrl: 'https://shop.example.com/blush',
        updatedAt: '2026-08-07T10:00:00.000Z',
        version: 1,
        videoUrl: 'https://video.example.com/blush.mp4',
      }).review.direction,
    ).toBe('rtl');
  });

  it('normalizes bounded product discovery and global search filters', () => {
    expect(
      discoveryRecommendationQuerySchema.parse({
        category: ' Beauty ',
        limit: '12',
        q: ' BLUSH ',
        sort: 'most-saved',
      }),
    ).toEqual({
      category: 'beauty',
      limit: 12,
      q: 'blush',
      sort: 'most-saved',
    });
    expect(globalSearchQuerySchema.parse({ q: ' Noa ' })).toEqual({
      limit: 5,
      q: 'noa',
    });
    expect(() => discoveryRecommendationQuerySchema.parse({ sort: 'price' })).toThrow();
    expect(() => globalSearchQuerySchema.parse({ q: 'a' })).toThrow();
  });

  it('bounds shopper engagement batches and pagination', () => {
    const creatorId = '01989f72-07e4-7f32-9b42-1ba55d4ca010';
    const productId = '01989f72-07e4-7f32-9b42-1ba55d4ca011';

    expect(
      engagementStateInputSchema.parse({
        creatorIds: [creatorId],
        productIds: [productId],
      }),
    ).toEqual({ creatorIds: [creatorId], productIds: [productId] });
    expect(engagementListQuerySchema.parse({ limit: '12' })).toEqual({ limit: 12 });
    expect(() => engagementStateInputSchema.parse({})).toThrow();
    expect(() => engagementListQuerySchema.parse({ limit: '100' })).toThrow();
  });

  it('normalizes bounded merchant-domain queue filters', () => {
    expect(
      merchantDomainQueueQuerySchema.parse({ limit: '25', status: 'rejected' }),
    ).toEqual({ limit: 25, status: 'rejected' });

    expect(() =>
      merchantDomainQueueQuerySchema.parse({ limit: '100', status: 'unknown' }),
    ).toThrow();
  });

  it('requires an explicit permission for approval and a reason for denial', () => {
    expect(merchantDomainApprovalInputSchema.parse({})).toEqual({
      allowImport: false,
      allowRedirect: true,
    });
    expect(() =>
      merchantDomainApprovalInputSchema.parse({
        allowImport: false,
        allowRedirect: false,
      }),
    ).toThrow();
    expect(() => merchantDomainReasonInputSchema.parse({ note: '  ' })).toThrow();
  });

  it('keeps creator analytics totals and daily series nonnegative', () => {
    const metric = {
      codeCopies: 2,
      recommendationViews: 21,
      shopClicks: 4,
      storyCompletions: 3,
      storyOpens: 5,
      storefrontViews: 10,
      uniqueVisitors: 8,
    };
    const dashboard = creatorAnalyticsDashboardSchema.parse({
      range: { days: 7, from: '2026-08-02', to: '2026-08-08' },
      recommendations: [
        {
          codeCopies: 2,
          id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
          productName: 'Soft Pinch Liquid Blush',
          shopClicks: 4,
          storyCompletions: 3,
          storyOpens: 5,
          views: 21,
        },
      ],
      series: [{ date: '2026-08-08', ...metric }],
      summary: metric,
    });

    expect(dashboard.summary.shopClicks).toBe(4);
    expect(() =>
      creatorAnalyticsDashboardSchema.parse({
        ...dashboard,
        summary: { ...metric, shopClicks: -1 },
      }),
    ).toThrow();
  });
});
