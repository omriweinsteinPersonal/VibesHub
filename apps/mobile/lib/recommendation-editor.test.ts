import { describe, expect, it } from 'vitest';

import {
  emptyRecommendationDraft,
  recommendationDraftWithMetadata,
  recommendationInput,
} from './recommendation-editor';

const categoryId = '018f47e2-1f6b-7d5a-b209-5f469f300004';

describe('native recommendation editor', () => {
  it('creates a manual item when no merchant link was supplied', () => {
    const input = recommendationInput(
      {
        ...emptyRecommendationDraft,
        brandName: 'Bosch',
        categoryId,
        priceIls: '129.90',
        productName: 'Mixer',
      },
      '018f47e2-1f6b-7d5a-b209-5f469f300005',
    );

    expect(input.priceAmountMinor).toBe(12_990);
    expect(input.productUrl).toContain('/manual-recommendation/');
    expect(input.reviewHe).toBe('No written review yet.');
  });

  it('merges fetched metadata without deleting creator-entered values', () => {
    const draft = recommendationDraftWithMetadata(
      { ...emptyRecommendationDraft, review: 'My review' },
      {
        brandName: 'Bosch',
        categorySlug: 'home',
        description: null,
        imageUrl: 'https://example.com/mixer.jpg',
        imageUrls: ['https://example.com/mixer.jpg'],
        priceAmountMinor: 44_990,
        productName: 'Mixer',
        productUrl: 'https://example.com/mixer',
      },
      categoryId,
    );

    expect(draft).toMatchObject({
      brandName: 'Bosch',
      categoryId,
      priceIls: '449.9',
      review: 'My review',
    });
  });

  it('rejects malformed links and fractional agorot', () => {
    expect(() =>
      recommendationInput(
        {
          ...emptyRecommendationDraft,
          brandName: 'Bosch',
          categoryId,
          priceIls: '1.999',
          productName: 'Mixer',
          productUrl: 'ftp://example.com/mixer',
        },
        'manual',
      ),
    ).toThrow('price');
  });

  it('creates native link cards without product-only fields', () => {
    const input = recommendationInput(
      {
        ...emptyRecommendationDraft,
        categoryId,
        contentKind: 'link',
        productName: 'My travel guide',
        productUrl: 'https://example.com/guide',
      },
      'manual',
    );

    expect(input).toMatchObject({
      additionalImages: [],
      brandName: 'Links',
      contentKind: 'link',
      priceAmountMinor: 0,
      reviewHe: 'Link card',
      storyClips: [],
    });
  });

  it('keeps advanced product media, disclosure, and discount fields', () => {
    const input = recommendationInput(
      {
        ...emptyRecommendationDraft,
        additionalImages: [{ imageAssetId: '', url: 'https://example.com/second.jpg' }],
        brandName: 'Bosch',
        categoryId,
        commercialRelationship: 'affiliate',
        discountCode: 'OMRI15',
        discountType: 'percent',
        discountValue: '15',
        instagramStoryUrl: 'https://www.instagram.com/stories/omri/123/',
        productName: 'Mixer',
        storyClips: [{ mediaAssetId: '', url: 'https://example.com/story.mp4' }],
      },
      'manual',
    );

    expect(input).toMatchObject({
      commercialRelationship: 'affiliate',
      discountCode: 'OMRI15',
      discountPercent: 15,
      instagramStoryUrl: 'https://www.instagram.com/stories/omri/123/',
    });
    expect(input.additionalImages).toEqual([
      { imageUrl: 'https://example.com/second.jpg' },
    ]);
    expect(input.storyClips).toEqual([{ videoUrl: 'https://example.com/story.mp4' }]);
  });
});
