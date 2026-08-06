export const accountStatuses = ['active', 'suspended', 'deleted'] as const;
export const creatorStatuses = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'suspended',
] as const;
export const publicationStatuses = ['draft', 'pending', 'published', 'rejected'] as const;

export type AccountStatus = (typeof accountStatuses)[number];
export type CreatorStatus = (typeof creatorStatuses)[number];
export type PublicationStatus = (typeof publicationStatuses)[number];

export interface RecommendationPublicationInput {
  creatorStatus: CreatorStatus;
  hasImage: boolean;
  hasProductLink: boolean;
  hasReviewInHebrew: boolean;
}

export type PublicationDecision =
  | { allowed: true }
  | {
      allowed: false;
      reasons: Array<
        | 'creator_not_approved'
        | 'image_required'
        | 'product_link_required'
        | 'hebrew_review_required'
      >;
    };

export function canPublishRecommendation(
  input: RecommendationPublicationInput,
): PublicationDecision {
  const reasons: Exclude<PublicationDecision, { allowed: true }>['reasons'] = [];

  if (input.creatorStatus !== 'approved') reasons.push('creator_not_approved');
  if (!input.hasImage) reasons.push('image_required');
  if (!input.hasProductLink) reasons.push('product_link_required');
  if (!input.hasReviewInHebrew) reasons.push('hebrew_review_required');

  return reasons.length === 0 ? { allowed: true } : { allowed: false, reasons };
}
