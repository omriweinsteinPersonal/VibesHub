import { describe, expect, it } from 'vitest';

import { featuredMediaProvider } from './featured-media';

describe('featured media provider', () => {
  it.each([
    ['https://www.instagram.com/p/example', 'instagram'],
    ['https://www.tiktok.com/@creator/video/123', 'tiktok'],
    ['https://open.spotify.com/track/example', 'spotify'],
    ['https://music.apple.com/us/album/example', 'apple_music'],
    ['https://maps.app.goo.gl/example', 'maps'],
    ['https://www.google.com/maps/place/Tel+Aviv', 'maps'],
    ['https://www.youtube.com/watch?v=example', 'youtube'],
  ] as const)('classifies %s as %s', (url, provider) => {
    expect(featuredMediaProvider(url)).toBe(provider);
  });

  it('does not classify unrelated Google links as maps', () => {
    expect(featuredMediaProvider('https://drive.google.com/file/example')).toBe(
      'youtube',
    );
  });
});
