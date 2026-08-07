import { describe, expect, it } from 'vitest';

import { detectImageContentType, recommendationImageObjectPath } from './image-media.js';
import { DeferredVideoPreviewProvider } from './video-provider.js';

describe('recommendation media boundaries', () => {
  it('builds a creator-owned object path with a type-derived extension', () => {
    expect(
      recommendationImageObjectPath(
        '01989f72-07e4-7f32-9b42-1ba55d4ca010',
        '01989f72-07e4-7f32-9b42-1ba55d4ca011',
        'image/webp',
      ),
    ).toBe(
      '01989f72-07e4-7f32-9b42-1ba55d4ca010/01989f72-07e4-7f32-9b42-1ba55d4ca011.webp',
    );
  });

  it('detects image content from magic bytes rather than trusting the header', () => {
    expect(detectImageContentType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    );
    expect(
      detectImageContentType(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe('image/png');
    expect(
      detectImageContentType(
        Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe('image/webp');
    expect(detectImageContentType(Uint8Array.from([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
  });

  it('keeps video URLs behind a provider boundary and HTTPS-only', () => {
    const provider = new DeferredVideoPreviewProvider();
    expect(provider.normalizeExternalPreviewUrl('https://video.example/story.mp4')).toBe(
      'https://video.example/story.mp4',
    );
    expect(() =>
      provider.normalizeExternalPreviewUrl('http://video.example/story.mp4'),
    ).toThrow('Video previews require HTTPS');
  });
});
