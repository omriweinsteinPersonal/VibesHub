import { describe, expect, it } from 'vitest';

import {
  canPublishRecommendation,
  canSubmitCreatorApplication,
  canTransitionCreatorApplication,
} from './index.js';

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

describe('creator application policy', () => {
  it('allows only legal lifecycle commands', () => {
    expect(canTransitionCreatorApplication('draft', 'submit')).toBe(true);
    expect(canTransitionCreatorApplication('submitted', 'approve')).toBe(false);
    expect(canTransitionCreatorApplication('under_review', 'approve')).toBe(true);
    expect(canTransitionCreatorApplication('approved', 'withdraw')).toBe(false);
  });

  it('requires a Hebrew bio and complete discovery identity before submission', () => {
    expect(
      canSubmitCreatorApplication({
        bioText: 'Beauty products I use',
        displayName: 'Noa Levi',
        primaryCategoryId: null,
        requestedHandle: 'noa-levi',
        socialLinkCount: 0,
      }),
    ).toEqual({
      allowed: false,
      reasons: [
        'bio_hebrew_required',
        'primary_category_required',
        'social_link_required',
      ],
    });

    expect(
      canSubmitCreatorApplication({
        bioText: 'המלצות אמיתיות על מוצרים שאני אוהבת',
        displayName: 'Noa Levi',
        primaryCategoryId: 'category-id',
        requestedHandle: 'noa-levi',
        socialLinkCount: 1,
      }),
    ).toEqual({ allowed: true });
  });
});
