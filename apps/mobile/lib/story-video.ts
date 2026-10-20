import type { StoryVideoContentType } from '@vibeshub/contracts';

const supportedVideoTypes = new Set<StoryVideoContentType>([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

export function storyVideoMimeType(
  mimeType?: string | null,
  fileName?: string | null,
): StoryVideoContentType {
  if (supportedVideoTypes.has(mimeType as StoryVideoContentType)) {
    return mimeType as StoryVideoContentType;
  }
  const normalizedName = fileName?.toLowerCase() ?? '';
  if (normalizedName.endsWith('.mov')) return 'video/quicktime';
  if (normalizedName.endsWith('.webm')) return 'video/webm';
  if (normalizedName.endsWith('.mp4')) return 'video/mp4';
  throw new Error('Choose an MP4, WebM, or QuickTime video.');
}
