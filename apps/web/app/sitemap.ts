import type { MetadataRoute } from 'next';

import { siteUrl } from '../lib/site-metadata';

const publicPaths = [
  '',
  '/about',
  '/creators',
  '/discover',
  '/privacy',
  '/shoppers',
  '/support',
  '/terms',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path, index) => ({
    changeFrequency: index === 0 ? 'weekly' : 'monthly',
    priority: index === 0 ? 1 : 0.7,
    url: `${siteUrl}${path || '/'}`,
  }));
}
