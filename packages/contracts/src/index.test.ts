import { describe, expect, it } from 'vitest';

import {
  creatorRecommendationInputSchema,
  creatorRecommendationMoveInputSchema,
  creatorCardSchema,
  creatorApplicationInputSchema,
  creatorDirectoryQuerySchema,
  directionalTextSchema,
  engagementStateInputSchema,
  engagementListQuerySchema,
  moneySchema,
  merchantDomainApprovalInputSchema,
  merchantDomainQueueQuerySchema,
  merchantDomainReasonInputSchema,
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

  it('keeps the public recommendation card image-first contract explicit', () => {
    expect(
      recommendationCardSchema.parse({
        brandName: 'Rare Beauty',
        category: { name: 'Beauty', slug: 'beauty' },
        commercialRelationship: 'affiliate',
        createdAt: '2026-08-07T10:00:00.000Z',
        discount: { code: 'NOA10', label: '10% off' },
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
});
