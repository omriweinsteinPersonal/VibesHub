import type { MetadataRoute } from 'next';

import { siteUrl } from '../lib/site-metadata';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: '/',
      disallow: ['/account/', '/admin/', '/analytics', '/auth/', '/creator-home'],
      userAgent: '*',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
