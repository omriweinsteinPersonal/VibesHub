import { describe, expect, it } from 'vitest';

import { ApiProblem } from '../api-problem.js';
import {
  catalogSlug,
  decodeRecommendationCursor,
  encodeRecommendationCursor,
  normalizeCatalogName,
  parseIfMatch,
} from './recommendation.js';

describe('recommendation primitives', () => {
  it('normalizes catalog identity without losing display copy', () => {
    expect(normalizeCatalogName('  Rare   BEAUTY  ')).toBe('rare beauty');
    expect(catalogSlug('Rare Beauty', 'rare beauty')).toMatch(
      /^rare-beauty-[a-f0-9]{8}$/,
    );
    expect(catalogSlug('מותג', 'מותג')).toMatch(/^item-[a-f0-9]{8}$/);
  });

  it('binds keyset cursors to one collection scope', () => {
    const cursor = {
      archived: false,
      id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
      position: 4,
    };
    const encoded = encodeRecommendationCursor(cursor, 'storefront:noa-levi');

    expect(decodeRecommendationCursor(encoded, 'storefront:noa-levi')).toEqual(cursor);
    expect(() => decodeRecommendationCursor(encoded, 'storefront:maya-cohen')).toThrow(
      ApiProblem,
    );
  });

  it('requires strong version preconditions for mutations', () => {
    expect(parseIfMatch('"7"')).toBe(7);
    expect(() => parseIfMatch('7')).toThrow(ApiProblem);
    expect(() => parseIfMatch('W/"7"')).toThrow(ApiProblem);
  });
});
