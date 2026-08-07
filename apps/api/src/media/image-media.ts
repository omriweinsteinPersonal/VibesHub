import type { RecommendationImageContentType } from '@vibeshub/contracts';

export const RECOMMENDATION_IMAGE_BUCKET = 'recommendation-images' as const;
export const RECOMMENDATION_IMAGE_UPLOAD_BUCKET = 'recommendation-image-uploads' as const;
export const RECOMMENDATION_IMAGE_MAX_BYTES = 5 * 1_024 * 1_024;
export const SIGNED_UPLOAD_LIFETIME_MS = 2 * 60 * 60 * 1_000;

const extensionByContentType: Record<RecommendationImageContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function recommendationImageObjectPath(
  userId: string,
  assetId: string,
  contentType: RecommendationImageContentType,
): string {
  return `${userId}/${assetId}.${extensionByContentType[contentType]}`;
}

export function detectImageContentType(
  bytes: Uint8Array,
): RecommendationImageContentType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}
