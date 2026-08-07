export const accountStatuses = ['active', 'suspended', 'deleted'] as const;
export const creatorStatuses = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'suspended',
] as const;
export const publicationStatuses = ['draft', 'pending', 'published', 'rejected'] as const;
export const creatorApplicationStatuses = [
  'draft',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
  'withdrawn',
] as const;

export type AccountStatus = (typeof accountStatuses)[number];
export type CreatorStatus = (typeof creatorStatuses)[number];
export type PublicationStatus = (typeof publicationStatuses)[number];
export type CreatorApplicationStatus = (typeof creatorApplicationStatuses)[number];

export type CreatorApplicationCommand =
  'submit' | 'withdraw' | 'start_review' | 'request_changes' | 'approve' | 'reject';

const creatorApplicationTransitions: Record<
  CreatorApplicationCommand,
  readonly CreatorApplicationStatus[]
> = {
  approve: ['under_review'],
  reject: ['under_review'],
  request_changes: ['under_review'],
  start_review: ['submitted'],
  submit: ['draft', 'changes_requested'],
  withdraw: ['draft', 'submitted', 'changes_requested'],
};

export function canTransitionCreatorApplication(
  status: CreatorApplicationStatus,
  command: CreatorApplicationCommand,
): boolean {
  return creatorApplicationTransitions[command].includes(status);
}

export interface CreatorApplicationSubmissionInput {
  bioText: string | null;
  displayName: string | null;
  primaryCategoryId: string | null;
  requestedHandle: string | null;
  socialLinkCount: number;
}

export type CreatorApplicationSubmissionDecision =
  | { allowed: true }
  | {
      allowed: false;
      reasons: Array<
        | 'bio_hebrew_required'
        | 'display_name_required'
        | 'primary_category_required'
        | 'requested_handle_required'
        | 'social_link_required'
      >;
    };

export function canSubmitCreatorApplication(
  input: CreatorApplicationSubmissionInput,
): CreatorApplicationSubmissionDecision {
  const reasons: Exclude<
    CreatorApplicationSubmissionDecision,
    { allowed: true }
  >['reasons'] = [];
  if (!input.requestedHandle) reasons.push('requested_handle_required');
  if (!input.displayName?.trim()) reasons.push('display_name_required');
  if (!input.bioText?.trim() || !/[\u0590-\u05ff]/u.test(input.bioText)) {
    reasons.push('bio_hebrew_required');
  }
  if (!input.primaryCategoryId) reasons.push('primary_category_required');
  if (input.socialLinkCount < 1) reasons.push('social_link_required');
  return reasons.length === 0 ? { allowed: true } : { allowed: false, reasons };
}

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
