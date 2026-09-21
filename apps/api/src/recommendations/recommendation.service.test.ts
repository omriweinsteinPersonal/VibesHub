import { describe, expect, it, vi } from 'vitest';

import type { CreatorRecommendationRecord } from './recommendation.repository.js';
import { RecommendationService } from './recommendation.service.js';

const recommendation: CreatorRecommendationRecord = {
  brandId: '01989f72-07e4-7f32-9b42-1ba55d4ca012',
  brandName: 'Rare Beauty',
  category: { name: 'Beauty', slug: 'beauty' },
  categoryId: '01989f72-07e4-7f32-9b42-1ba55d4ca013',
  categoryIds: ['01989f72-07e4-7f32-9b42-1ba55d4ca013'],
  commercialRelationship: 'organic',
  createdAt: '2026-08-07T10:00:00.000Z',
  discount: null,
  id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
  imageAssetId: null,
  imageUrl: 'https://images.example.com/blush.jpg',
  instagramStoryUrl: null,
  lifecycle: 'published',
  merchantHostname: 'shop.example.com',
  position: 2,
  price: { amountMinor: 12_000, currency: 'ILS' },
  productId: '01989f72-07e4-7f32-9b42-1ba55d4ca011',
  productName: 'Soft Pinch Liquid Blush',
  productUrl: 'https://shop.example.com/blush',
  review: {
    direction: 'rtl',
    language: 'he',
    value: 'המוצר האהוב עליי למראה טבעי וזוהר',
  },
  shopUrl: 'https://api.example.com/v1/go/01989f72-07e4-7f32-9b42-1ba55d4ca012',
  storyClips: [],
  updatedAt: '2026-08-07T10:00:00.000Z',
  version: 3,
  videoUrl: null,
};

describe('RecommendationService management transitions', () => {
  it('archives published content through the owned repository command', async () => {
    const archived = { ...recommendation, lifecycle: 'archived' as const, version: 4 };
    const repository = {
      archiveOwned: vi.fn().mockResolvedValue(archived),
      findOwned: vi.fn().mockResolvedValue(recommendation),
    };
    const service = new RecommendationService(repository as never, {} as never);

    await expect(service.archive(recommendation.id, 'user-id', 3)).resolves.toEqual(
      archived,
    );
    expect(repository.archiveOwned).toHaveBeenCalledWith(recommendation.id, 'user-id', 3);
  });

  it('restores archived content as a draft', async () => {
    const archived = { ...recommendation, lifecycle: 'archived' as const };
    const restored = { ...recommendation, lifecycle: 'draft' as const, version: 4 };
    const repository = {
      findOwned: vi.fn().mockResolvedValue(archived),
      restoreOwned: vi.fn().mockResolvedValue(restored),
    };
    const service = new RecommendationService(repository as never, {} as never);

    await expect(service.restore(recommendation.id, 'user-id', 3)).resolves.toEqual(
      restored,
    );
  });

  it('does not allow archived content to move in storefront order', async () => {
    const repository = {
      findOwned: vi
        .fn()
        .mockResolvedValue({ ...recommendation, lifecycle: 'archived' as const }),
      moveOwned: vi.fn(),
    };
    const service = new RecommendationService(repository as never, {} as never);

    await expect(
      service.move(recommendation.id, 'user-id', 3, { direction: 'up' }),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_STATE_TRANSITION' },
    });
    expect(repository.moveOwned).not.toHaveBeenCalled();
  });
});
