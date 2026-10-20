import {
  recommendationImageAssetSchema,
  recommendationImageUploadSchema,
  storyVideoAssetSchema,
  storyVideoUploadSchema,
  type RecommendationImageAsset,
  type RecommendationImageContentType,
  type StoryVideoAsset,
  type StoryVideoContentType,
} from '@vibeshub/contracts';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import { creatorRequest } from './creator-api';
import { getSupabaseClient } from './supabase';

export { storyVideoMimeType } from './story-video';

const maximumImageBytes = 5 * 1_024 * 1_024;
const supportedTypes = new Set<RecommendationImageContentType>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const maximumVideoBytes = 200 * 1_024 * 1_024;
const supportedVideoTypes = new Set<StoryVideoContentType>([
  'video/mp4',
  'video/quicktime',
  'video/webm',
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

export async function uploadCreatorStoryVideo(input: {
  fileSize: number;
  mimeType: string;
  uri: string;
}): Promise<StoryVideoAsset> {
  const file = new File(input.uri);
  const fileSize = input.fileSize || file.size;
  if (!supportedVideoTypes.has(input.mimeType as StoryVideoContentType)) {
    throw new Error('Choose an MP4, WebM, or QuickTime video.');
  }
  if (fileSize < 1 || fileSize > maximumVideoBytes) {
    throw new Error('The video must be 200 MB or smaller.');
  }

  const upload = await creatorRequest(
    '/v1/creator/media/videos/uploads',
    storyVideoUploadSchema.parse,
    {
      body: JSON.stringify({
        contentType: input.mimeType,
        fileSizeBytes: fileSize,
      }),
      headers: { 'idempotency-key': Crypto.randomUUID() },
      method: 'POST',
    },
  );

  try {
    await uploadStoryVideoResumable(file, upload);

    return creatorRequest(
      `/v1/creator/media/videos/${upload.assetId}/complete`,
      storyVideoAssetSchema.parse,
      {
        headers: { 'idempotency-key': Crypto.randomUUID() },
        method: 'POST',
      },
    );
  } catch (cause) {
    await creatorRequest(`/v1/creator/media/videos/${upload.assetId}`, () => undefined, {
      method: 'DELETE',
    }).catch(() => undefined);
    throw cause;
  }
}

const videoChunkBytes = 6 * 1_024 * 1_024;

async function uploadStoryVideoResumable(
  file: File,
  upload: {
    bucket: string;
    contentType: StoryVideoContentType;
    objectPath: string;
    token: string;
  },
): Promise<void> {
  const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!projectUrl || !publishableKey) {
    throw new Error('Supabase public environment variables are not configured');
  }

  const endpoint = new URL('/storage/v1/upload/resumable', projectUrl);
  if (
    endpoint.hostname.endsWith('.supabase.co') &&
    !endpoint.hostname.endsWith('.storage.supabase.co')
  ) {
    endpoint.hostname = endpoint.hostname.replace(
      /\.supabase\.co$/u,
      '.storage.supabase.co',
    );
  }
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
    headers: {
      ...commonHeaders,
      'Upload-Length': String(file.size),
      'Upload-Metadata': metadata,
    },
    method: 'POST',
  });
  if (created.status === 403 && file.size <= videoChunkBytes) {
    const bytes = await file.arrayBuffer();
    const { error } = await getSupabaseClient()
      .storage.from(upload.bucket)
      .uploadToSignedUrl(upload.objectPath, upload.token, bytes, {
        cacheControl: '31536000',
        contentType: upload.contentType,
      });
    if (!error) return;
    throw new Error(`Video upload was rejected (403): ${error.message}`);
  }
  if (!created.ok) {
    if (created.status === 413) {
      throw new Error('This video exceeds the storage size limit.');
    }
    const detail = await created.text().catch(() => '');
    throw new Error(
      `Video upload could not start (${created.status})${detail ? `: ${detail}` : ''}.`,
    );
  }
  const location = created.headers.get('Location');
  if (!location) throw new Error('Storage did not return an upload address.');

  const uploadUrl = new URL(location, endpoint);
  let offset = Number(created.headers.get('Upload-Offset') ?? 0);
  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + videoChunkBytes, file.size));
    let uploaded = false;
    for (const delay of [0, 3000, 5000, 10000, 20000]) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const response = await fetch(uploadUrl, {
          body: chunk,
          headers: {
            ...commonHeaders,
            'Content-Type': 'application/offset+octet-stream',
            'Upload-Offset': String(offset),
          },
          method: 'PATCH',
        });
        if (response.status === 413) {
          throw new Error('VIDEO_STORAGE_LIMIT');
        }
        if (!response.ok) {
          throw new Error(`Storage rejected the video chunk (${response.status}).`);
        }
        offset = Number(response.headers.get('Upload-Offset') ?? offset + chunk.size);
        uploaded = true;
        break;
      } catch (cause) {
        if (cause instanceof Error && cause.message === 'VIDEO_STORAGE_LIMIT') {
          throw new Error('This video exceeds the storage size limit.');
        }
        const head = await fetch(uploadUrl, {
          headers: commonHeaders,
          method: 'HEAD',
        }).catch(() => null);
        if (head?.ok) {
          const remoteOffset = Number(head.headers.get('Upload-Offset'));
          if (Number.isFinite(remoteOffset) && remoteOffset > offset) {
            offset = remoteOffset;
            uploaded = true;
            break;
          }
        }
      }
    }
    if (!uploaded) {
      throw new Error(
        'Video upload was interrupted. Check your connection and try again.',
      );
    }
  }
}
