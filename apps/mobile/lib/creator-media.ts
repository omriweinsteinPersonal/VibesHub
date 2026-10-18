import {
  recommendationImageAssetSchema,
  recommendationImageUploadSchema,
  type RecommendationImageAsset,
  type RecommendationImageContentType,
} from '@vibeshub/contracts';
import * as Crypto from 'expo-crypto';

import { creatorRequest } from './creator-api';
import { getSupabaseClient } from './supabase';

const maximumImageBytes = 5 * 1_024 * 1_024;
const supportedTypes = new Set<RecommendationImageContentType>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export async function uploadCreatorImage(input: {
  fileSize: number;
  mimeType: string;
  uri: string;
}): Promise<RecommendationImageAsset> {
  if (!supportedTypes.has(input.mimeType as RecommendationImageContentType)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (input.fileSize < 1 || input.fileSize > maximumImageBytes) {
    throw new Error('The image must be smaller than 5 MB.');
  }

  const upload = await creatorRequest(
    '/v1/creator/media/images/uploads',
    recommendationImageUploadSchema.parse,
    {
      body: JSON.stringify({
        contentType: input.mimeType,
        fileSizeBytes: input.fileSize,
      }),
      headers: { 'idempotency-key': Crypto.randomUUID() },
      method: 'POST',
    },
  );

  try {
    const file = await fetch(input.uri);
    if (!file.ok) throw new Error('The selected image could not be read.');
    const bytes = await file.arrayBuffer();
    const { error } = await getSupabaseClient()
      .storage.from(upload.bucket)
      .uploadToSignedUrl(upload.objectPath, upload.token, bytes, {
        cacheControl: '31536000',
        contentType: upload.contentType,
      });
    if (error) throw new Error(error.message);

    return creatorRequest(
      `/v1/creator/media/images/${upload.assetId}/complete`,
      recommendationImageAssetSchema.parse,
      {
        headers: { 'idempotency-key': Crypto.randomUUID() },
        method: 'POST',
      },
    );
  } catch (cause) {
    await creatorRequest(`/v1/creator/media/images/${upload.assetId}`, () => undefined, {
      method: 'DELETE',
    }).catch(() => undefined);
    throw cause;
  }
}
