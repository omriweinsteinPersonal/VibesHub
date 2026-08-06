import { describe, expect, it } from 'vitest';

import { canPublishRecommendation } from './index.js';

describe('recommendation publication policy', () => {
  it('allows complete recommendations from approved creators', () => {
    expect(
      canPublishRecommendation({
        creatorStatus: 'approved',
        hasImage: true,
        hasProductLink: true,
        hasReviewInHebrew: true,
      }),
    ).toEqual({ allowed: true });
  });

  it('reports every missing publication requirement', () => {
    expect(
      canPublishRecommendation({
        creatorStatus: 'pending',
        hasImage: false,
        hasProductLink: false,
        hasReviewInHebrew: false,
      }),
    ).toEqual({
      allowed: false,
      reasons: [
        'creator_not_approved',
        'image_required',
        'product_link_required',
        'hebrew_review_required',
      ],
    });
  });
});
