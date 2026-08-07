import { describe, expect, it } from 'vitest';

import { ApiProblem } from '../api-problem.js';
import {
  decodeProductDiscoveryCursor,
  encodeProductDiscoveryCursor,
  parseGlobalSearchQuery,
  parseProductDiscoveryQuery,
} from './product-discovery.js';

describe('product discovery query primitives', () => {
  const id = '01989f72-07e4-7f32-9b42-1ba55d4ca010';

  it('round-trips a keyset cursor bound to every discovery filter', () => {
    const query = parseProductDiscoveryQuery({
      category: ' Beauty ',
      q: ' Blush ',
      sort: 'most-saved',
    });
    const encoded = encodeProductDiscoveryCursor(
      { id, publishedAt: '2026-08-07T10:00:00.000Z', rank: 24 },
      query,
    );

    expect(decodeProductDiscoveryCursor(encoded, query)).toEqual({
      category: 'beauty',
      id,
      publishedAt: '2026-08-07T10:00:00.000Z',
      q: 'blush',
      rank: 24,
      sort: 'most-saved',
    });
  });

  it('rejects a cursor reused under another sort', () => {
    const query = parseProductDiscoveryQuery({ sort: 'trending' });
    const encoded = encodeProductDiscoveryCursor(
      { id, publishedAt: '2026-08-07T10:00:00.000Z', rank: 4 },
      query,
    );

    expect(() =>
      decodeProductDiscoveryCursor(
        encoded,
        parseProductDiscoveryQuery({ sort: 'newest' }),
      ),
    ).toThrow(ApiProblem);
  });

  it('requires at least two characters for live search', () => {
    expect(parseGlobalSearchQuery({ q: ' Noa ' })).toEqual({ limit: 5, q: 'noa' });
    expect(() => parseGlobalSearchQuery({ q: 'n' })).toThrow();
  });
});
