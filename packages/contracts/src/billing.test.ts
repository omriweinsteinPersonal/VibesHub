import { describe, expect, it } from 'vitest';

import { billingSummarySchema, hasCreatorProAccess } from './billing.js';

const now = Date.parse('2026-10-22T12:00:00Z');
const base = { customerId: 'a055b0b3-6bb4-4f9b-98bd-3b018d90a311' };
describe('billing summary', () => {
  it('requires a boolean server decision and a valid opaque customer id', () => {
    expect(
      billingSummarySchema.safeParse({
        ...base,
        entitlements: [{ key: 'creator_pro', active: 'true', expiresAt: null }],
      }).success,
    ).toBe(false);
    expect(
      billingSummarySchema.safeParse({ customerId: 'user@example.com', entitlements: [] })
        .success,
    ).toBe(false);
  });
  it.each([
    [{ key: 'creator_pro', active: true, expiresAt: '2026-10-23T12:00:00Z' }, true],
    [{ key: 'creator_pro', active: true, expiresAt: '2026-10-22T12:00:00Z' }, false],
    [{ key: 'creator_pro', active: false, expiresAt: null }, false],
    [{ key: 'unrelated', active: true, expiresAt: null }, false],
  ] as const)(
    'keeps web and native access consistent for %o',
    (entitlement, expected) => {
      const summary = billingSummarySchema.parse({
        ...base,
        entitlements: [entitlement],
      });
      expect(hasCreatorProAccess(summary, now)).toBe(expected);
    },
  );
});
