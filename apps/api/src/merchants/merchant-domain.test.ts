import { describe, expect, it } from 'vitest';

import { ApiProblem } from '../api-problem.js';
import {
  decodeMerchantDomainQueueCursor,
  encodeMerchantDomainQueueCursor,
} from './merchant-domain.js';

const cursor = {
  createdAt: '2026-08-07T10:00:00.000Z',
  id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
  status: 'pending' as const,
};

describe('merchant-domain queue cursor', () => {
  it('round-trips the queue position and status filter', () => {
    expect(
      decodeMerchantDomainQueueCursor(encodeMerchantDomainQueueCursor(cursor), 'pending'),
    ).toEqual(cursor);
  });

  it('rejects a cursor reused across moderation states', () => {
    expect(() =>
      decodeMerchantDomainQueueCursor(
        encodeMerchantDomainQueueCursor(cursor),
        'approved',
      ),
    ).toThrow(ApiProblem);
  });
});
