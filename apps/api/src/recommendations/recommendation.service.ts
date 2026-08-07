import { Injectable } from '@nestjs/common';
import {
  creatorRecommendationInputSchema,
  type CreatorRecommendationInput,
  type CreatorRecommendationPatch,
} from '@vibeshub/contracts';

import { problem } from '../api-problem.js';
import type { RecommendationCursor } from './recommendation.js';
import {
  RecommendationRepository,
  type RecommendationPage,
  type RecommendationRecord,
} from './recommendation.repository.js';

@Injectable()
export class RecommendationService {
  constructor(private readonly recommendations: RecommendationRepository) {}

  async create(
    userId: string,
    input: CreatorRecommendationInput,
  ): Promise<RecommendationRecord> {
    try {
      const created = await this.recommendations.create(userId, input);
      if (!created) throw this.creatorAccessRequired();
      return created;
    } catch (error) {
      this.translateCatalogError(error);
    }
  }

  async getOwned(id: string, userId: string): Promise<RecommendationRecord> {
    const recommendation = await this.recommendations.findOwned(id, userId);
    if (!recommendation) {
      throw problem(404, 'RESOURCE_NOT_FOUND', 'Recommendation not found');
    }
    return recommendation;
  }

  async listOwned(
    userId: string,
    limit: number,
    cursor: RecommendationCursor | null,
  ): Promise<RecommendationPage> {
    const page = await this.recommendations.listOwned(userId, limit, cursor);
    if (!page) throw this.creatorAccessRequired();
    return page;
  }

  async update(
    id: string,
    userId: string,
    expectedVersion: number,
    patch: CreatorRecommendationPatch,
  ): Promise<RecommendationRecord> {
    const current = await this.requireCurrentVersion(id, userId, expectedVersion);
    const input = creatorRecommendationInputSchema.parse({
      brandName: current.brandName,
      categoryId: current.categoryId,
      commercialRelationship: current.commercialRelationship,
      discountCode: current.discount?.code ?? null,
      discountLabel: current.discount?.label ?? null,
      imageUrl: current.imageUrl,
      priceAmountMinor: current.price.amountMinor,
      productName: current.productName,
      productUrl: current.shopUrl,
      reviewHe: current.review.value,
      videoUrl: current.videoUrl,
      ...patch,
    });
    try {
      const updated = await this.recommendations.replaceOwned(
        id,
        userId,
        expectedVersion,
        input,
      );
      if (!updated) throw this.preconditionFailed();
      return updated;
    } catch (error) {
      this.translateCatalogError(error);
    }
  }

  async publish(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<RecommendationRecord> {
    const current = await this.requireCurrentVersion(id, userId, expectedVersion);
    if (current.lifecycle !== 'draft') {
      throw problem(
        409,
        'INVALID_STATE_TRANSITION',
        'Only a draft recommendation can be published',
      );
    }
    const published = await this.recommendations.transitionOwned(
      id,
      userId,
      expectedVersion,
      'published',
    );
    if (!published) throw this.preconditionFailed();
    return published;
  }

  async unpublish(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<RecommendationRecord> {
    const current = await this.requireCurrentVersion(id, userId, expectedVersion);
    if (current.lifecycle !== 'published') {
      throw problem(
        409,
        'INVALID_STATE_TRANSITION',
        'Only a published recommendation can be unpublished',
      );
    }
    const draft = await this.recommendations.transitionOwned(
      id,
      userId,
      expectedVersion,
      'draft',
    );
    if (!draft) throw this.preconditionFailed();
    return draft;
  }

  private async requireCurrentVersion(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<RecommendationRecord> {
    const current = await this.getOwned(id, userId);
    if (current.version !== expectedVersion) throw this.preconditionFailed();
    return current;
  }

  private creatorAccessRequired() {
    return problem(403, 'CAPABILITY_REQUIRED', 'An approved creator profile is required');
  }

  private preconditionFailed() {
    return problem(
      412,
      'PRECONDITION_FAILED',
      'The recommendation changed since it was loaded',
      'Reload the recommendation and retry with its current version.',
    );
  }

  private translateCatalogError(error: unknown): never {
    if (error instanceof Error && error.message === 'OFFER_PRODUCT_IDENTITY_CONFLICT') {
      throw problem(
        409,
        'RESOURCE_CONFLICT',
        'That product link already belongs to another catalog product',
      );
    }
    if (hasPostgresCode(error, '23505')) {
      throw problem(
        409,
        'RESOURCE_CONFLICT',
        'This creator already has an active recommendation for that product',
      );
    }
    throw error;
  }
}

function hasPostgresCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
