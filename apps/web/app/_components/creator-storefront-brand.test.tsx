import { creatorStorefrontSchema } from '@vibeshub/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CreatorStorefrontView } from './creator-storefront';

const brandId = '22222222-2222-4222-8222-222222222222';

function renderBrand(logoUrl: string | null) {
  const storefront = creatorStorefrontSchema.parse({
    avatarUrl: null,
    bio: { direction: 'ltr', language: 'en', value: '' },
    displayName: 'Creator',
    followerCount: 0,
    handle: 'creator',
    id: '11111111-1111-4111-8111-111111111111',
    primaryCategory: { name: 'Fashion', slug: 'fashion' },
    recommendationCount: 0,
    brands: [
      {
        brandId,
        collectionCount: 0,
        id: brandId,
        itemCount: 0,
        name: 'Brand without products',
        websiteUrl: 'https://brand.example',
        logoUrl,
      },
    ],
    socialLinks: [],
    verificationStatus: 'unverified',
  });
  return renderToStaticMarkup(
    <CreatorStorefrontView
      codes={[]}
      recommendations={[]}
      storefront={storefront}
      trackStorefrontView={false}
    />,
  );
}

describe('brand-only storefront recommendations', () => {
  it('renders a newly created brand without products or a coupon', () => {
    const markup = renderBrand(null);
    expect(markup).toContain('data-brand-only="true"');
    expect(markup).toContain('Brand without products');
  });

  it('renders the saved brand image instead of substituting a website favicon', () => {
    const imageUrl = 'https://images.example/uploaded-logo.png';
    const markup = renderBrand(imageUrl);
    expect(markup).toContain('data-has-logo="true"');
    expect(markup).toContain(`src="${imageUrl}"`);
    expect(renderBrand(null)).not.toContain('favicon.ico');
  });
});
