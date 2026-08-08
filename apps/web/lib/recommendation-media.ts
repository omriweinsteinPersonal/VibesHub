import type {
  RecommendationImageAsset,
  RecommendationImageContentType,
  RecommendationImageUpload,
} from '@vibeshub/contracts';

import { apiRequest } from './api';
import { getSupabaseBrowserClient } from './supabase-browser';

export const recommendationImageAccept = 'image/jpeg,image/png,image/webp';
export const recommendationImageMaxBytes = 5 * 1_024 * 1_024;
export const creatorImageAccept = recommendationImageAccept;

const supportedTypes = new Set<RecommendationImageContentType>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export async function uploadRecommendationImage(
  file: File,
  onStage: (stage: 'authorizing' | 'uploading' | 'validating') => void,
): Promise<RecommendationImageAsset> {
  if (!supportedTypes.has(file.type as RecommendationImageContentType)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size < 1 || file.size > recommendationImageMaxBytes) {
    throw new Error('The image must be smaller than 5 MB.');
  }

  onStage('authorizing');
  const upload = await apiRequest<RecommendationImageUpload>(
    '/creator/media/images/uploads',
    {
      body: JSON.stringify({ contentType: file.type, fileSizeBytes: file.size }),
      idempotent: true,
      method: 'POST',
    },
  );

  try {
    onStage('uploading');
    const { error } = await getSupabaseBrowserClient()
      .storage.from(upload.bucket)
      .uploadToSignedUrl(upload.objectPath, upload.token, file, {
        cacheControl: '31536000',
        contentType: upload.contentType,
      });
    if (error) throw new Error(error.message);

    onStage('validating');
    return await apiRequest<RecommendationImageAsset>(
      `/creator/media/images/${upload.assetId}/complete`,
      { idempotent: true, method: 'POST' },
    );
  } catch (error) {
    await deleteRecommendationImage(upload.assetId).catch(() => undefined);
    throw error;
  }
}

export const uploadCreatorImage = uploadRecommendationImage;

export async function deleteRecommendationImage(assetId: string): Promise<void> {
  await apiRequest<void>(`/creator/media/images/${assetId}`, { method: 'DELETE' });
}
