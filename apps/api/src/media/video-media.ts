import type { StoryVideoContentType } from '@vibeshub/contracts';

export const STORY_VIDEO_BUCKET = 'story-videos' as const;
export const STORY_VIDEO_UPLOAD_BUCKET = 'story-video-uploads' as const;
export const STORY_VIDEO_MAX_BYTES = 50 * 1_024 * 1_024;

const extensionByContentType: Record<StoryVideoContentType, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

export function storyVideoObjectPath(
  userId: string,
  assetId: string,
  contentType: StoryVideoContentType,
): string {
  return `${userId}/${assetId}.${extensionByContentType[contentType]}`;
}

export function detectVideoContentType(bytes: Uint8Array): StoryVideoContentType | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return 'video/webm';
  }
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    return brand.startsWith('qt') ? 'video/quicktime' : 'video/mp4';
  }
  return null;
}
