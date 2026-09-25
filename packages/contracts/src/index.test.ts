import { describe, expect, it } from 'vitest';

import {
  creatorAnalyticsDashboardSchema,
  creatorRecommendationInputSchema,
  creatorRecommendationMoveInputSchema,
  creatorStorefrontConfigurationInputSchema,
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
  recommendationImageAssetSchema,
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

  it('allows local media URLs without allowing insecure remote media', () => {
    const asset = {
      contentType: 'image/png',
      id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
      publicUrl:
        'http://127.0.0.1:55321/storage/v1/object/public/recommendation-images/avatar.png',
      sizeBytes: 1024,
      status: 'ready',
    };
    expect(recommendationImageAssetSchema.parse(asset).publicUrl).toBe(asset.publicUrl);
    expect(() =>
      recommendationImageAssetSchema.parse({
        ...asset,
        publicUrl: 'http://images.example.com/avatar.png',
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

  it('accepts Instagram story and Highlight links but rejects other destinations', () => {
    const input = {
      brandName: 'Rare Beauty',
      categoryId: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
      imageUrl: 'https://images.example.com/blush.jpg',
      priceAmountMinor: 12_000,
      productName: 'Soft Pinch Liquid Blush',
      productUrl: 'https://shop.example.com/blush',
      reviewHe: 'A lovely product',
    };
    expect(
      creatorRecommendationInputSchema.parse({
        ...input,
        instagramStoryUrl: 'https://www.instagram.com/stories/creator/123456/',
      }).instagramStoryUrl,
    ).toBe('https://www.instagram.com/stories/creator/123456/');
    expect(
      creatorRecommendationInputSchema.parse({
        ...input,
        instagramStoryUrl: 'https://instagram.com/stories/highlights/123456/',
      }).instagramStoryUrl,
    ).toBe('https://instagram.com/stories/highlights/123456/');
    for (const url of [
      'https://instagram.com.evil.example/stories/creator/123456/',
      'https://www.instagram.com/reel/123456/',
      'http://www.instagram.com/stories/creator/123456/',
    ]) {
      expect(() =>
        creatorRecommendationInputSchema.parse({ ...input, instagramStoryUrl: url }),
      ).toThrow();
    }
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

  it('validates creator-owned section definitions without changing global categories', () => {
    const section = {
      id: '01989f72-07e4-7f32-9b42-1ba55d4ca020',
      kind: 'collection',
      title: 'Fox favorites',
      recommendationIds: ['01989f72-07e4-7f32-9b42-1ba55d4ca021'],
    };
    expect(
      creatorStorefrontConfigurationInputSchema.parse({
        categoryIds: [],
        curatedSections: [section],
      }).curatedSections,
    ).toEqual([
      {
        ...section,
        brandId: null,
        description: '',
        imageUrl: null,
        parentCollectionId: null,
        showItemsIndividually: false,
      },
    ]);
    expect(
      creatorStorefrontConfigurationInputSchema.parse({
        categoryIds: [],
        curatedSections: [
          {
            id: '01989f72-07e4-7f32-9b42-1ba55d4ca022',
            kind: 'page',
            title: 'Summer picks',
            description: 'Selected for sunny days',
            parentCollectionId: section.id,
            recommendationIds: section.recommendationIds,
          },
          section,
        ],
      }).curatedSections[0]?.kind,
    ).toBe('page');
    expect(() =>
      creatorStorefrontConfigurationInputSchema.parse({
        categoryIds: [],
        curatedSections: [section, section],
      }),
    ).toThrow();
    expect(() =>
      creatorStorefrontConfigurationInputSchema.parse({
        categoryIds: [],
        curatedSections: [{ ...section, title: '' }],
      }),
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
      instagramTaps: 4,
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
          categoryName: 'Beauty',
          categorySlug: 'beauty',
          codeCopies: 2,
          id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
          imageUrl: null,
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


describe('storefront text blocks', () => {
  it('distinguishes unrelated updates from explicitly removing all text', () => {
    expect(creatorStorefrontConfigurationInputSchema.parse({ categoryIds: [] }).titles).toBeUndefined();
    expect(creatorStorefrontConfigurationInputSchema.parse({ categoryIds: [], titles: [] }).titles).toEqual([]);
  });
  it('preserves paragraphs and positioning and rejects duplicate block identities', () => {
    const text = { id: '11111111-1111-4111-8111-111111111111', text: 'First line\nSecond line', format: 'paragraph', align: 'start', size: 'medium', beforeId: '22222222-2222-4222-8222-222222222222' };
    expect(creatorStorefrontConfigurationInputSchema.parse({ categoryIds: [], titles: [text] }).titles).toEqual([text]);
    expect(creatorStorefrontConfigurationInputSchema.safeParse({ categoryIds: [], titles: [text, text] }).success).toBe(false);
  });
});


describe('storefront block editor', () => {
  it('keeps unrelated writes separate from resetting the brand order', () => {
    expect(creatorStorefrontConfigurationInputSchema.parse({ categoryIds: [] }).brandOrder).toBeUndefined();
    expect(creatorStorefrontConfigurationInputSchema.parse({ categoryIds: [], brandOrder: [] }).brandOrder).toEqual([]);
  });
  it('round trips a text card and rejects unsafe CSS values and duplicate brands', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const text = { id, text: 'New collection', align: 'center', size: 'small', beforeId: null, appearance: 'card', background: '#f1e8dc', padding: 'small', radius: 'rounded' };
    expect(creatorStorefrontConfigurationInputSchema.parse({ categoryIds: [], titles: [text], brandOrder: [id] }).titles).toEqual([text]);
    expect(creatorStorefrontConfigurationInputSchema.safeParse({ categoryIds: [], titles: [{ ...text, background: 'url(https://example.com)' }] }).success).toBe(false);
    expect(creatorStorefrontConfigurationInputSchema.safeParse({ categoryIds: [], brandOrder: [id,id] }).success).toBe(false);
  });
});
