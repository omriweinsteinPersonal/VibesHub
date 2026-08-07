import type {
  CreatorApplicationSocialLink,
  CreatorApplicationStatus,
} from '@vibeshub/contracts';

export interface CreatorApplicationRecord {
  bioText: string | null;
  createdAt: string;
  decidedAt: string | null;
  displayName: string | null;
  feedback: CreatorApplicationFeedbackRecord[];
  id: string;
  primaryCategoryId: string | null;
  requestedHandle: string | null;
  socialLinks: CreatorApplicationSocialLink[];
  status: CreatorApplicationStatus;
  submittedAt: string | null;
  updatedAt: string;
  userId: string;
  version: number;
}

export interface CreatorApplicationFeedbackRecord {
  createdAt: string;
  decision: 'changes_requested' | 'approved' | 'rejected';
  publicMessage: string;
}

export interface CreatorApplicationReviewRecord {
  createdAt: string;
  decision: 'started' | 'changes_requested' | 'approved' | 'rejected';
  id: string;
  privateNotes: string | null;
  publicMessage: string | null;
  reviewerUserId: string;
}

export interface AdminCreatorApplicationRecord extends CreatorApplicationRecord {
  reviews: CreatorApplicationReviewRecord[];
}
