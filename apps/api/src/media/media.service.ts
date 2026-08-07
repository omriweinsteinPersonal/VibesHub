import { Injectable } from '@nestjs/common';
import type {
  RecommendationImageAsset,
  RecommendationImageUpload,
  RecommendationImageUploadInput,
} from '@vibeshub/contracts';

import { problem } from '../api-problem.js';
import {
  detectImageContentType,
  RECOMMENDATION_IMAGE_UPLOAD_BUCKET,
  recommendationImageObjectPath,
  SIGNED_UPLOAD_LIFETIME_MS,
} from './image-media.js';
import { MediaRepository, type MediaAssetRow } from './media.repository.js';
import { MediaStorageGateway } from './media-storage.gateway.js';

@Injectable()
export class MediaService {
  constructor(
    private readonly media: MediaRepository,
    private readonly storage: MediaStorageGateway,
  ) {}

  async createImageUpload(
    userId: string,
    input: RecommendationImageUploadInput,
  ): Promise<RecommendationImageUpload> {
    const assetId = crypto.randomUUID();
    const objectPath = recommendationImageObjectPath(userId, assetId, input.contentType);
    const expiresAt = new Date(Date.now() + SIGNED_UPLOAD_LIFETIME_MS).toISOString();
    await this.media.createPending({
      contentType: input.contentType,
      declaredSizeBytes: input.fileSizeBytes,
      expiresAt,
      id: assetId,
      objectPath,
      userId,
    });

    try {
      const token = await this.storage.createSignedUpload(objectPath);
      return {
        assetId,
        bucket: RECOMMENDATION_IMAGE_UPLOAD_BUCKET,
        contentType: input.contentType,
        expiresAt,
        objectPath,
        token,
      };
    } catch (error) {
      await this.media.markFailed(assetId, userId, 'missing_object');
      throw error;
    }
  }

  async completeImageUpload(
    userId: string,
    assetId: string,
  ): Promise<RecommendationImageAsset> {
    const asset = await this.requireOwned(assetId, userId);
    if (asset.status === 'ready') return this.toReadyAsset(asset);
    if (asset.status !== 'pending_upload') {
      throw problem(409, 'INVALID_STATE_TRANSITION', 'This image upload is not active');
    }

    let blob: Blob;
    try {
      blob = await this.storage.downloadUpload(asset.objectPath);
    } catch {
      await this.failUpload(asset, userId, 'missing_object');
      throw problem(422, 'MEDIA_NOT_READY', 'The image upload could not be found');
    }

    const detectedType = detectImageContentType(
      new Uint8Array(await blob.slice(0, 16).arrayBuffer()),
    );
    if (!detectedType || detectedType !== asset.contentType) {
      await this.failUpload(asset, userId, 'invalid_content');
      throw problem(
        422,
        'UNSUPPORTED_MEDIA_TYPE',
        'The uploaded file does not match its declared image type',
      );
    }
    if (blob.size !== Number(asset.declaredSizeBytes)) {
      await this.failUpload(asset, userId, 'size_mismatch');
      throw problem(
        422,
        'VALIDATION_FAILED',
        'The uploaded image size does not match the requested upload',
      );
    }

    try {
      await this.storage.publishVerified(asset.objectPath, asset.contentType, blob);
    } catch (error) {
      const concurrent = await this.requireOwned(asset.id, userId);
      if (concurrent.status === 'ready') return this.toReadyAsset(concurrent);
      throw error;
    }

    const ready = await this.media.markReady(
      asset.id,
      userId,
      asset.version,
      blob.size,
      this.storage.publicUrl(asset.objectPath),
    );
    if (ready) {
      await this.storage.removeUpload(asset.objectPath).catch(() => undefined);
      return this.toReadyAsset(ready);
    }

    const concurrent = await this.requireOwned(asset.id, userId);
    if (concurrent.status === 'ready') {
      await this.storage.removeUpload(asset.objectPath).catch(() => undefined);
      return this.toReadyAsset(concurrent);
    }
    await this.storage.removePublished(asset.objectPath).catch(() => undefined);
    throw problem(409, 'RESOURCE_CONFLICT', 'The image upload changed while completing');
  }

  async deleteImage(userId: string, assetId: string): Promise<void> {
    const asset = await this.requireOwned(assetId, userId);
    if (asset.status === 'deleted') return;
    if ((await this.media.countReferences(assetId)) > 0) {
      throw problem(
        409,
        'RESOURCE_CONFLICT',
        'Detach this image from its product and recommendation before deleting it',
      );
    }
    try {
      if (asset.status === 'ready') {
        await this.storage.removePublished(asset.objectPath);
      } else {
        await this.storage.removeUpload(asset.objectPath);
      }
    } catch (error) {
      if (asset.status === 'ready') throw error;
    }
    await this.media.markDeleted(assetId, userId);
  }

  private async failUpload(
    asset: MediaAssetRow,
    userId: string,
    code: 'missing_object' | 'invalid_content' | 'size_mismatch',
  ): Promise<void> {
    try {
      await this.storage.removeUpload(asset.objectPath);
    } catch {
      // The database state still prevents a failed object from being attached.
    }
    await this.media.markFailed(asset.id, userId, code);
  }

  private async requireOwned(assetId: string, userId: string): Promise<MediaAssetRow> {
    const asset = await this.media.findOwned(assetId, userId);
    if (!asset) throw problem(404, 'RESOURCE_NOT_FOUND', 'Image asset not found');
    return asset;
  }

  private toReadyAsset(asset: MediaAssetRow): RecommendationImageAsset {
    if (asset.status !== 'ready' || !asset.publicUrl || !asset.sizeBytes) {
      throw new Error('A ready media asset is missing completion metadata');
    }
    return {
      contentType: asset.contentType,
      id: asset.id,
      publicUrl: asset.publicUrl,
      sizeBytes: Number(asset.sizeBytes),
      status: 'ready',
    };
  }
}
