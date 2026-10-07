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
import { getSupabasePublicConfig } from './config';

export const recommendationImageAccept = 'image/jpeg,image/png,image/webp';
export const recommendationImageMaxBytes = 5 * 1_024 * 1_024;
export const creatorImageAccept = recommendationImageAccept;
export const storyVideoAccept = 'video/mp4,video/webm,video/quicktime';
export const storyVideoMaxBytes = 200 * 1_024 * 1_024;

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
  onStage: (stage: 'authorizing' | 'uploading' | 'validating', percent?: number) => void,
): Promise<StoryVideoAsset> {
  const extensionType = file.name.toLowerCase().endsWith('.mov')
    ? 'video/quicktime'
    : file.name.toLowerCase().endsWith('.mp4')
      ? 'video/mp4'
      : file.name.toLowerCase().endsWith('.webm')
        ? 'video/webm'
        : '';
  const inferredType = supportedVideoTypes.has(file.type as StoryVideoContentType)
    ? file.type
    : extensionType;
  if (!supportedVideoTypes.has(inferredType as StoryVideoContentType)) {
    throw new Error('Choose an MP4, WebM, or QuickTime video.');
  }
  if (file.size < 1 || file.size > storyVideoMaxBytes) {
    throw new Error('The video must be 200 MB or smaller.');
  }
  onStage('authorizing');
  const upload = await apiRequest<StoryVideoUpload>('/creator/media/videos/uploads', {
    body: JSON.stringify({ contentType: inferredType, fileSizeBytes: file.size }),
    idempotent: true,
    method: 'POST',
  });
  try {
    onStage('uploading', 0);
    await uploadVideoResumable(file, upload, onStage);
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

const videoChunkBytes = 6 * 1_024 * 1_024;

export async function uploadVideoResumable(
  file: File,
  upload: StoryVideoUpload,
  onStage: (stage: 'authorizing' | 'uploading' | 'validating', percent?: number) => void,
): Promise<void> {
  const { publishableKey, url } = getSupabasePublicConfig();
  const endpoint = new URL('/storage/v1/upload/resumable', url);
  if (
    endpoint.hostname.endsWith('.supabase.co') &&
    !endpoint.hostname.endsWith('.storage.supabase.co')
  ) {
    endpoint.hostname = endpoint.hostname.replace(
      /\.supabase\.co$/u,
      '.storage.supabase.co',
    );
  }
  // A signed upload token authorizes the object, but the Storage TUS gateway
  // still requires the project's public API key. `uploadToSignedUrl` adds this
  // header for normal uploads; our resumable path must do the same.
  const commonHeaders = {
    apikey: publishableKey,
    'Tus-Resumable': '1.0.0',
    'x-signature': upload.token,
  };
  const metadata = [
    ['bucketName', upload.bucket],
    ['objectName', upload.objectPath],
    ['contentType', upload.contentType],
    ['cacheControl', '31536000'],
  ]
    .map(([key, value]) => `${key} ${btoa(value ?? '')}`)
    .join(',');
  const created = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'Upload-Length': String(file.size),
      'Upload-Metadata': metadata,
    },
  });
  if (!created.ok)
    throw new Error(
      `Video upload could not start (${created.status}). Check the storage size limit and try again.`,
    );
  const location = created.headers.get('Location');
  if (!location) throw new Error('Storage did not return an upload address. Try again.');
  const uploadUrl = new URL(location, endpoint);
  let offset = Number(created.headers.get('Upload-Offset') ?? 0);
  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + videoChunkBytes, file.size));
    let uploaded = false;
    for (const delay of [0, 3000, 5000, 10000, 20000]) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const response = await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            ...commonHeaders,
            'Content-Type': 'application/offset+octet-stream',
            'Upload-Offset': String(offset),
          },
          body: chunk,
        });
        if (response.status === 413) throw new Error('VIDEO_STORAGE_LIMIT');
        if (!response.ok)
          throw new Error(`Storage rejected the video chunk (${response.status}).`);
        offset = Number(response.headers.get('Upload-Offset') ?? offset + chunk.size);
        onStage('uploading', Math.round((offset / file.size) * 100));
        uploaded = true;
        break;
      } catch (error) {
        if (error instanceof Error && error.message === 'VIDEO_STORAGE_LIMIT')
          throw new Error(
            'This video exceeds the current storage limit. Try a smaller file or contact support.',
          );
        const head = await fetch(uploadUrl, {
          method: 'HEAD',
          headers: commonHeaders,
        }).catch(() => null);
        if (head?.ok) {
          const remoteOffset = Number(head.headers.get('Upload-Offset'));
          if (Number.isFinite(remoteOffset) && remoteOffset > offset) {
            offset = remoteOffset;
            uploaded = true;
            onStage('uploading', Math.round((offset / file.size) * 100));
            break;
          }
        }
      }
    }
    if (!uploaded)
      throw new Error(
        'Video upload was interrupted. Check your connection and try again.',
      );
  }
}

export async function deleteStoryVideo(assetId: string): Promise<void> {
  await apiRequest<void>(`/creator/media/videos/${assetId}`, { method: 'DELETE' });
}
