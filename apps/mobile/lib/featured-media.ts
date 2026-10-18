import type { FeaturedMedia } from '@vibeshub/contracts';

export function featuredMediaProvider(value: string): FeaturedMedia['provider'] {
  const parsed = parseUrl(value);
  const hostname = parsed?.hostname.toLowerCase() ?? '';

  if (hostname.includes('instagram')) return 'instagram';
  if (hostname.includes('tiktok')) return 'tiktok';
  if (hostname.includes('spotify')) return 'spotify';
  if (hostname.includes('music.apple')) return 'apple_music';
  if (
    hostname === 'maps.google.com' ||
    hostname === 'maps.app.goo.gl' ||
    (['google.com', 'www.google.com'].includes(hostname) &&
      parsed?.pathname.startsWith('/maps'))
  )
    return 'maps';
  return 'youtube';
}

function parseUrl(value: string): URL | null {
  const trimmed = value.trim();
  const normalized = /^https:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, '')}`;
  try {
    return new URL(normalized);
  } catch {
    return null;
  }
}
