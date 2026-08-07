import { Injectable } from '@nestjs/common';
import type {
  CreatorApplicationInput,
  CreatorApplicationPatch,
  CreatorApplicationReviewInput,
} from '@vibeshub/contracts';
import {
  canSubmitCreatorApplication,
  canTransitionCreatorApplication,
  type CreatorApplicationCommand,
} from '@vibeshub/domain';

import { problem } from '../api-problem.js';
import { ApplicationRepository } from './application.repository.js';
import type {
  AdminCreatorApplicationRecord,
  CreatorApplicationRecord,
  CreatorApplicationReviewRecord,
} from './application.types.js';

@Injectable()
export class ApplicationService {
  constructor(private readonly applications: ApplicationRepository) {}

  async create(
    userId: string,
    input: CreatorApplicationInput,
  ): Promise<CreatorApplicationRecord> {
    const current = await this.applications.findCurrent(userId);
    if (current) {
      throw problem(
        409,
        'RESOURCE_CONFLICT',
        'This account already has a creator application',
      );
    }
    return this.applications.create(userId, input);
  }

  getCurrent(userId: string): Promise<CreatorApplicationRecord | null> {
    return this.applications.findCurrent(userId);
  }

  async update(
    id: string,
    userId: string,
    input: CreatorApplicationPatch,
  ): Promise<CreatorApplicationRecord> {
    const application = await this.requireOwned(id, userId);
    if (!['draft', 'changes_requested'].includes(application.status)) {
      throw this.invalidTransition(application.status, 'edit');
    }
    const updated = await this.applications.updateOwned(id, userId, input);
    if (!updated) throw this.invalidTransition(application.status, 'edit');
    return updated;
  }

  async submit(id: string, userId: string): Promise<CreatorApplicationRecord> {
    const application = await this.requireOwned(id, userId);
    this.requireTransition(application.status, 'submit');
    const decision = canSubmitCreatorApplication({
      bioText: application.bioText,
      displayName: application.displayName,
      primaryCategoryId: application.primaryCategoryId,
      requestedHandle: application.requestedHandle,
      socialLinkCount: application.socialLinks.length,
    });
    if (!decision.allowed) {
      throw problem(
        422,
        'VALIDATION_FAILED',
        'The creator application is incomplete',
        undefined,
        decision.reasons.map((reason) => ({
          code: reason.toUpperCase(),
          message: reason,
        })),
      );
    }
    if (
      !application.requestedHandle ||
      !(await this.applications.isHandleAvailable(
        application.requestedHandle,
        application.id,
      ))
    ) {
      throw problem(
        409,
        'RESOURCE_CONFLICT',
        'The requested creator handle is unavailable',
      );
    }
    const changed = await this.applications.transitionOwned(
      id,
      userId,
      [application.status],
      'submitted',
    );
    if (!changed) throw this.invalidTransition(application.status, 'submit');
    return (await this.applications.findById(id)) ?? application;
  }

  async withdraw(id: string, userId: string): Promise<CreatorApplicationRecord> {
    const application = await this.requireOwned(id, userId);
    this.requireTransition(application.status, 'withdraw');
    const changed = await this.applications.transitionOwned(
      id,
      userId,
      [application.status],
      'withdrawn',
    );
    if (!changed) throw this.invalidTransition(application.status, 'withdraw');
    return (await this.applications.findById(id)) ?? application;
  }

  listForReview(): Promise<CreatorApplicationRecord[]> {
    return this.applications.listForReview();
  }

  async getForReview(id: string): Promise<AdminCreatorApplicationRecord> {
    const application = await this.applications.findAdminById(id);
    if (!application)
      throw problem(404, 'RESOURCE_NOT_FOUND', 'Creator application not found');
    return application;
  }

  async startReview(
    id: string,
    reviewerUserId: string,
    review: CreatorApplicationReviewInput,
  ): Promise<AdminCreatorApplicationRecord> {
    return this.staffTransition(
      id,
      reviewerUserId,
      'start_review',
      'under_review',
      'started',
      review,
    );
  }

  async requestChanges(
    id: string,
    reviewerUserId: string,
    review: CreatorApplicationReviewInput,
  ): Promise<AdminCreatorApplicationRecord> {
    if (!review.publicMessage) {
      throw problem(422, 'VALIDATION_FAILED', 'An applicant-visible message is required');
    }
    return this.staffTransition(
      id,
      reviewerUserId,
      'request_changes',
      'changes_requested',
      'changes_requested',
      review,
    );
  }

  async reject(
    id: string,
    reviewerUserId: string,
    review: CreatorApplicationReviewInput,
  ): Promise<AdminCreatorApplicationRecord> {
    if (!review.publicMessage) {
      throw problem(
        422,
        'VALIDATION_FAILED',
        'An applicant-visible rejection reason is required',
      );
    }
    return this.staffTransition(
      id,
      reviewerUserId,
      'reject',
      'rejected',
      'rejected',
      review,
    );
  }

  async approve(
    id: string,
    reviewerUserId: string,
    review: CreatorApplicationReviewInput,
  ): Promise<AdminCreatorApplicationRecord> {
    const application = await this.getForReview(id);
    this.requireTransition(application.status, 'approve');
    if (
      !application.requestedHandle ||
      !(await this.applications.isHandleAvailable(application.requestedHandle, id))
    ) {
      throw problem(
        409,
        'RESOURCE_CONFLICT',
        'The requested creator handle is unavailable',
      );
    }
    try {
      await this.applications.approve(id, reviewerUserId, review);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_APPLICATION_STATE') {
        throw this.invalidTransition(application.status, 'approve');
      }
      throw error;
    }
    return this.getForReview(id);
  }

  private async staffTransition(
    id: string,
    reviewerUserId: string,
    command: CreatorApplicationCommand,
    nextStatus: 'under_review' | 'changes_requested' | 'rejected',
    decision: CreatorApplicationReviewRecord['decision'],
    review: CreatorApplicationReviewInput,
  ): Promise<AdminCreatorApplicationRecord> {
    const application = await this.getForReview(id);
    this.requireTransition(application.status, command);
    const changed = await this.applications.recordReviewAndTransition(
      id,
      reviewerUserId,
      application.status,
      nextStatus,
      decision,
      review,
    );
    if (!changed) throw this.invalidTransition(application.status, command);
    return this.getForReview(id);
  }

  private async requireOwned(
    id: string,
    userId: string,
  ): Promise<CreatorApplicationRecord> {
    const application = await this.applications.findById(id);
    if (!application || application.userId !== userId) {
      throw problem(404, 'RESOURCE_NOT_FOUND', 'Creator application not found');
    }
    return application;
  }

  private requireTransition(
    status: CreatorApplicationRecord['status'],
    command: CreatorApplicationCommand,
  ): void {
    if (!canTransitionCreatorApplication(status, command)) {
      throw this.invalidTransition(status, command);
    }
  }

  private invalidTransition(status: string, command: string) {
    return problem(
      409,
      'INVALID_STATE_TRANSITION',
      'The creator application cannot perform this action',
      `Cannot ${command} an application in ${status} state.`,
    );
  }
}
