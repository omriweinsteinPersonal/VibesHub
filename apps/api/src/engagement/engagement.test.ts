import { describe, expect, it } from 'vitest';

import { ApiProblem } from '../api-problem.js';
import { decodeEngagementCursor, encodeEngagementCursor } from './engagement.js';

describe('engagement cursors', () => {
  const cursor = {
    id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
    timestamp: '2026-08-07T10:00:00.000Z',
  };

  it('round-trips a cursor bound to one private collection', () => {
    const encoded = encodeEngagementCursor(cursor, 'saved-products');
    expect(decodeEngagementCursor(encoded, 'saved-products')).toEqual(cursor);
  });

  it('rejects a cursor reused across private collections', () => {
    const encoded = encodeEngagementCursor(cursor, 'saved-products');
    expect(() => decodeEngagementCursor(encoded, 'followed-creators')).toThrow(
      ApiProblem,
    );
  });
});
