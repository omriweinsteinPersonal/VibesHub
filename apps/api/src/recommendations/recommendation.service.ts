import { Injectable } from '@nestjs/common';
import {
  creatorRecommendationInputSchema,
  type CreatorRecommendationInput,
  type CreatorRecommendationMoveInput,
  type CreatorRecommendationPatch,
} from '@vibeshub/contracts';

import { problem } from '../api-problem.js';
import { DeferredVideoPreviewProvider } from '../media/video-provider.js';
import type { RecommendationCursor } from './recommendation.js';
import {
  RecommendationRepository,
  type CreatorRecommendationPage,
  type CreatorRecommendationRecord,
} from './recommendation.repository.js';

@Injectable()
export class RecommendationService {
  constructor(
    private readonly recommendations: RecommendationRepository,
    private readonly videos: DeferredVideoPreviewProvider,
  ) {}

  async create(
    userId: string,
    input: CreatorRecommendationInput,
  ): Promise<CreatorRecommendationRecord> {
    try {
      const created = await this.recommendations.create(userId, {
        ...input,
        storyClips: this.normalizeStoryClips(input),
        videoUrl: this.videos.normalizeExternalPreviewUrl(input.videoUrl ?? null),
      });
      if (!created) throw this.creatorAccessRequired();
      return created;
    } catch (error) {
      this.translateCatalogError(error);
    }
  }

  async getOwned(id: string, userId: string): Promise<CreatorRecommendationRecord> {
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
  ): Promise<CreatorRecommendationPage> {
    const page = await this.recommendations.listOwned(userId, limit, cursor);
    if (!page) throw this.creatorAccessRequired();
    return page;
  }

  async update(
    id: string,
    userId: string,
    expectedVersion: number,
    patch: CreatorRecommendationPatch,
  ): Promise<CreatorRecommendationRecord> {
    const current = await this.requireCurrentVersion(id, userId, expectedVersion);
    const imagePatch = this.normalizeImagePatch(patch);
    const input = creatorRecommendationInputSchema.parse({
      brandName: current.brandName,
      categoryId: current.categoryId,
      commercialRelationship: current.commercialRelationship,
      discountCode: current.discount?.code ?? null,
      discountExpiresAt: current.discount?.expiresAt ?? null,
      discountLabel: current.discount?.label ?? null,
      imageAssetId: current.imageAssetId,
      imageUrl: current.imageAssetId ? null : current.imageUrl,
      priceAmountMinor: current.price.amountMinor,
      productName: current.productName,
      productUrl: current.productUrl,
      reviewHe: current.review.value,
      storyClips: current.storyClips.map((clip) =>
        clip.mediaAssetId ? { mediaAssetId: clip.mediaAssetId } : { videoUrl: clip.url },
      ),
      videoUrl: current.videoUrl,
      ...patch,
      ...imagePatch,
    });
    const normalizedInput = {
      ...input,
      storyClips: this.normalizeStoryClips(input),
      videoUrl: this.videos.normalizeExternalPreviewUrl(input.videoUrl ?? null),
    };
    try {
      const updated = await this.recommendations.replaceOwned(
        id,
        userId,
        expectedVersion,
        normalizedInput,
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
  ): Promise<CreatorRecommendationRecord> {
    const current = await this.requireCurrentVersion(id, userId, expectedVersion);
    if (current.lifecycle !== 'draft') {
      throw problem(
        409,
        'INVALID_STATE_TRANSITION',
        'Only a draft recommendation can be published',
      );
    }
    try {
      const published = await this.recommendations.transitionOwned(
        id,
        userId,
        expectedVersion,
        'published',
      );
      if (!published) throw this.preconditionFailed();
      return published;
    } catch (error) {
      this.translateCatalogError(error);
    }
  }

  async unpublish(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<CreatorRecommendationRecord> {
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

  async archive(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<CreatorRecommendationRecord> {
    const current = await this.requireCurrentVersion(id, userId, expectedVersion);
    if (current.lifecycle === 'archived') {
      throw problem(
        409,
        'INVALID_STATE_TRANSITION',
        'This recommendation is already archived',
      );
    }
    const archived = await this.recommendations.archiveOwned(id, userId, expectedVersion);
    if (!archived) throw this.preconditionFailed();
    return archived;
  }

  async restore(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<CreatorRecommendationRecord> {
    const current = await this.requireCurrentVersion(id, userId, expectedVersion);
    if (current.lifecycle !== 'archived') {
      throw problem(
        409,
        'INVALID_STATE_TRANSITION',
        'Only an archived recommendation can be restored',
      );
    }
    try {
      const restored = await this.recommendations.restoreOwned(
        id,
        userId,
        expectedVersion,
      );
      if (!restored) throw this.preconditionFailed();
      return restored;
    } catch (error) {
      this.translateCatalogError(error);
    }
  }

  async move(
    id: string,
    userId: string,
    expectedVersion: number,
    input: CreatorRecommendationMoveInput,
  ): Promise<CreatorRecommendationRecord> {
    const current = await this.requireCurrentVersion(id, userId, expectedVersion);
    if (current.lifecycle === 'archived') {
      throw problem(
        409,
        'INVALID_STATE_TRANSITION',
        'Restore this recommendation before changing its storefront position',
      );
    }
    const moved = await this.recommendations.moveOwned(
      id,
      userId,
      expectedVersion,
      input.direction,
    );
    if (!moved) throw this.preconditionFailed();
    return moved;
  }

  private async requireCurrentVersion(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<CreatorRecommendationRecord> {
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
    if (
      error instanceof Error &&
      (error.message === 'UNSAFE_REDIRECT_DESTINATION' ||
        error.message === 'INVALID_MERCHANT_HOSTNAME')
    ) {
      throw problem(
        422,
        'UNSAFE_REDIRECT_DESTINATION',
        'Use a public HTTPS product link without credentials or a custom port',
      );
    }
    if (
      error instanceof Error &&
      (error.message === 'MERCHANT_DOMAIN_NOT_APPROVED' ||
        error.message === 'MERCHANT_DOMAIN_CONFLICT')
    ) {
      throw problem(
        422,
        'MERCHANT_DOMAIN_NOT_APPROVED',
        'This merchant domain is not approved for VibesHub shopping links yet',
        'Keep the recommendation as a draft while the merchant domain is reviewed.',
      );
    }
    if (
      error instanceof Error &&
      (error.message === 'MEDIA_ASSET_NOT_READY_OR_OWNED' ||
        error.message === 'STORY_MEDIA_ASSET_NOT_READY_OR_OWNED' ||
        error.message === 'RECOMMENDATION_IMAGE_REQUIRED')
    ) {
      throw problem(
        422,
        'MEDIA_NOT_READY',
        'Choose an image that finished uploading to your media library',
      );
    }
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

  private normalizeImagePatch(patch: CreatorRecommendationPatch): {
    imageAssetId?: string | null;
    imageUrl?: string | null;
  } {
    if (patch.imageAssetId) return { imageAssetId: patch.imageAssetId, imageUrl: null };
    if (patch.imageUrl) return { imageAssetId: null, imageUrl: patch.imageUrl };
    return {};
  }

  private normalizeStoryClips(
    input: Pick<CreatorRecommendationInput, 'storyClips' | 'videoUrl'>,
  ): CreatorRecommendationInput['storyClips'] {
    if (!input.storyClips)
      return input.videoUrl
        ? [{ videoUrl: this.videos.normalizeExternalPreviewUrl(input.videoUrl) }]
        : [];
    return input.storyClips.map((clip) =>
      clip.mediaAssetId
        ? { mediaAssetId: clip.mediaAssetId }
        : { videoUrl: this.videos.normalizeExternalPreviewUrl(clip.videoUrl ?? null) },
    );
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
