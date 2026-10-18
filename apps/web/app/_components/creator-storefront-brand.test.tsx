import { creatorStorefrontSchema, defaultStorefrontTheme } from '@vibeshub/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CreatorStorefrontView } from './creator-storefront';

const brandId = '22222222-2222-4222-8222-222222222222';

function renderBrand(
  logoUrl: string | null,
  options: { editorial?: boolean; collection?: boolean; media?: boolean } = {},
) {
  const collectionId = '33333333-3333-4333-8333-333333333333';
  const mediaId = '44444444-4444-4444-8444-444444444444';
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
    theme: {
      ...defaultStorefrontTheme,
      templateId: options.editorial ? 'editorial-frame' : 'classic',
    },
    curatedSections: options.collection
      ? [
          {
            id: collectionId,
            kind: 'collection',
            brandId,
            title: 'Summer picks',
            recommendationIds: [],
            imageUrl: 'https://images.example/collection.png',
          },
        ]
      : [],
    featuredMedia: options.media
      ? [
          {
            id: mediaId,
            provider: 'spotify',
            url: 'https://open.spotify.com/track/example',
            title: 'Artist — Song',
            thumbnailUrl: 'https://images.example/cover.png',
            displayMode: 'embed',
          },
        ]
      : [],
    contentOrder: options.media ? [{ kind: 'media', id: mediaId }] : [],
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

  it('keeps Classic on its existing card renderer', () => {
    expect(renderBrand(null)).not.toContain('editorialBrandCard');
  });

  it('renders a collection as a tile inside the Editorial Frame brand card', () => {
    const markup = renderBrand(null, { editorial: true, collection: true });
    expect(markup).toContain('editorialBrandCard');
    expect(markup).toContain('editorialCollectionTile');
    expect(markup).toContain('/creator/pages/33333333-3333-4333-8333-333333333333');
    expect(markup).toContain('Summer picks');
  });

  it('uses an Editorial Frame media summary while preserving the saved artwork', () => {
    const markup = renderBrand(null, { editorial: true, media: true });
    expect(markup).toContain('editorialMediaCard');
    expect(markup).toContain('Artist — Song');
    expect(markup).toContain('https://images.example/cover.png');
    expect(renderBrand(null, { media: true })).not.toContain('editorialMediaCard');
  });
});
