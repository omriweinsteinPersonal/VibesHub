import type {
  RecommendationImageAsset,
  RecommendationImageContentType,
  RecommendationImageUpload,
  StoryVideoAsset,
  StoryVideoContentType,
  StoryVideoUpload,
} from '@vibeshub/contracts';

import { apiRequest } from './api';
import { getSupabaseBrowserClient } from './supabase-browser';

export const recommendationImageAccept = 'image/jpeg,image/png,image/webp';
export const recommendationImageMaxBytes = 5 * 1_024 * 1_024;
export const creatorImageAccept = recommendationImageAccept;
export const storyVideoAccept = 'video/mp4,video/webm,video/quicktime';
export const storyVideoMaxBytes = 50 * 1_024 * 1_024;

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

const supportedVideoTypes = new Set<StoryVideoContentType>([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export async function uploadStoryVideo(
  file: File,
  onStage: (stage: 'authorizing' | 'uploading' | 'validating') => void,
): Promise<StoryVideoAsset> {
  if (!supportedVideoTypes.has(file.type as StoryVideoContentType)) {
    throw new Error('Choose an MP4, WebM, or QuickTime video.');
  }
  if (file.size < 1 || file.size > storyVideoMaxBytes) {
    throw new Error('The story clip must be smaller than 50 MB.');
  }
  onStage('authorizing');
  const upload = await apiRequest<StoryVideoUpload>('/creator/media/videos/uploads', {
    body: JSON.stringify({ contentType: file.type, fileSizeBytes: file.size }),
    idempotent: true,
    method: 'POST',
  });
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
    return await apiRequest<StoryVideoAsset>(
      `/creator/media/videos/${upload.assetId}/complete`,
      { idempotent: true, method: 'POST' },
    );
  } catch (error) {
    await deleteStoryVideo(upload.assetId).catch(() => undefined);
    throw error;
  }
}

export async function deleteStoryVideo(assetId: string): Promise<void> {
  await apiRequest<void>(`/creator/media/videos/${assetId}`, { method: 'DELETE' });
}
