import { describe, expect, it } from 'vitest';

import { storyVideoMimeType } from './story-video';

describe('storyVideoMimeType', () => {
  it('keeps supported picker MIME types', () => {
    expect(storyVideoMimeType('video/webm', 'story.bin')).toBe('video/webm');
  });

  it('infers the MIME type when iOS omits it', () => {
    expect(storyVideoMimeType(null, 'STORY.MOV')).toBe('video/quicktime');
    expect(storyVideoMimeType(undefined, 'story.mp4')).toBe('video/mp4');
  });

  it('rejects unsupported video formats', () => {
    expect(() => storyVideoMimeType('video/avi', 'story.avi')).toThrow(
      'Choose an MP4, WebM, or QuickTime video.',
    );
  });
});
