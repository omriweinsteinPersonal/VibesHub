import { creatorStorefrontSchema } from '@vibeshub/contracts';
import { describe, expect, it } from 'vitest';

import {
  storefrontIncludesBrandLogos,
  storefrontResponse,
} from './storefront-response.js';

const storefront = creatorStorefrontSchema.parse({
  avatarUrl: null,
  bio: { direction: 'ltr', language: 'en', value: '' },
  brands: [
    {
      brandId: '00000000-0000-4000-8000-000000000001',
      collectionCount: 0,
      id: '00000000-0000-4000-8000-000000000002',
      itemCount: 1,
      logoUrl: 'https://example.com/logo.png',
      name: 'Example',
      websiteUrl: 'https://example.com',
    },
  ],
  curatedSections: [],
  displayName: 'Example Creator',
  featuredMedia: [],
  followerCount: 0,
  handle: 'example',
  id: '00000000-0000-4000-8000-000000000003',
  primaryCategory: { name: 'Lifestyle', slug: 'lifestyle' },
  recommendationCount: 1,
  socialLinks: [],
  storefrontSections: [],
  verificationStatus: 'unverified',
});

describe('storefront response compatibility', () => {
  it('omits brand logos by default for older native clients', () => {
    const response = storefrontResponse(storefront, false);

    expect(response.brands[0]).not.toHaveProperty('logoUrl');
  });

  it('includes brand logos for clients that opt in', () => {
    const response = storefrontResponse(storefront, true);

    expect(response.brands[0]).toHaveProperty('logoUrl', 'https://example.com/logo.png');
  });

  it('only opts in for explicit true values', () => {
    expect(storefrontIncludesBrandLogos({ includeBrandLogos: 'true' })).toBe(true);
    expect(storefrontIncludesBrandLogos({ includeBrandLogos: '1' })).toBe(true);
    expect(storefrontIncludesBrandLogos({ includeBrandLogos: 'false' })).toBe(false);
    expect(storefrontIncludesBrandLogos({})).toBe(false);
  });
});
