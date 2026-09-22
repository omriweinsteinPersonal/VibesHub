import type { CreatorStorefront, RecommendationCard } from '@vibeshub/contracts';
import { describe, expect, it } from 'vitest';

import { groupRecommendations } from './creator-storefront';

describe('storefront collection grouping', () => {
  it('keeps a selected product in its collection when its category appears first', () => {
    const product = {
      id: 'product-1',
      category: { slug: 'fox' },
    } as RecommendationCard;
    const storefront = {
      storefrontSections: [{ id: 'category-1', name: 'Fox', slug: 'fox' }],
      curatedSections: [
        {
          id: 'collection-1',
          kind: 'collection',
          title: 'my fox favs',
          recommendationIds: ['product-1'],
        },
      ],
      contentOrder: [
        { kind: 'recommendation', id: 'product-1' },
        { kind: 'category', id: 'category-1' },
        { kind: 'collection', id: 'collection-1' },
      ],
    } as unknown as CreatorStorefront;

    const rows = groupRecommendations(storefront, [product]);

    expect(rows.map(({ title }) => title)).toEqual(['my fox favs']);
    expect(rows[0]?.items).toEqual([product]);
    expect(rows[0]?.framed).toBe(true);
  });

  it('keeps a collection visible for its product page and leaves page products in the storefront', () => {
    const product = {
      id: 'product-1',
      brandName: 'Billabong',
      category: { slug: 'fashion' },
    } as RecommendationCard;
    const storefront = {
      storefrontSections: [],
      curatedSections: [
        {
          id: 'collection-1',
          kind: 'collection',
          title: 'Billabong',
          recommendationIds: [],
        },
        {
          id: 'page-1',
          kind: 'page',
          title: 'Summer picks',
          parentCollectionId: 'collection-1',
          recommendationIds: ['product-1'],
        },
      ],
      contentOrder: [
        { kind: 'collection', id: 'collection-1' },
        { kind: 'recommendation', id: 'product-1' },
      ],
    } as unknown as CreatorStorefront;

    const rows = groupRecommendations(storefront, [product]);

    expect(rows[0]).toMatchObject({ key: 'collection-1', framed: true, items: [] });
    expect(rows[1]?.items).toEqual([product]);
  });

  it('shows the same item in each collection it belongs to', () => {
    const product = {
      id: 'product-1',
      category: { slug: 'fashion' },
    } as RecommendationCard;
    const storefront = {
      storefrontSections: [],
      curatedSections: [
        {
          id: 'summer',
          kind: 'collection',
          title: 'Summer',
          recommendationIds: ['product-1'],
        },
        {
          id: 'favorites',
          kind: 'collection',
          title: 'Favorites',
          recommendationIds: ['product-1'],
        },
      ],
      contentOrder: [
        { kind: 'collection', id: 'summer' },
        { kind: 'collection', id: 'favorites' },
      ],
    } as unknown as CreatorStorefront;

    expect(groupRecommendations(storefront, [product]).map(({ items }) => items)).toEqual(
      [[product], [product]],
    );
  });
});
