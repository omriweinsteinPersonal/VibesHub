import { describe, expect, it } from 'vitest';

import {
  creatorApplicationInputSchema,
  directionalTextSchema,
  moneySchema,
} from './index.js';

describe('shared API contracts', () => {
  it('accepts an ILS amount represented in minor units', () => {
    expect(moneySchema.parse({ amountMinor: 12_000, currency: 'ILS' })).toEqual({
      amountMinor: 12_000,
      currency: 'ILS',
    });
  });

  it('keeps Hebrew direction explicit', () => {
    expect(
      directionalTextSchema.parse({ direction: 'rtl', language: 'he', value: 'מומלץ' }),
    ).toMatchObject({ direction: 'rtl', language: 'he' });
  });

  it('normalizes creator handles and rejects insecure social links', () => {
    expect(
      creatorApplicationInputSchema.parse({
        requestedHandle: ' Noa_Levi ',
        socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/noa' }],
      }).requestedHandle,
    ).toBe('noa_levi');

    expect(() =>
      creatorApplicationInputSchema.parse({
        socialLinks: [{ platform: 'website', url: 'http://example.com' }],
      }),
    ).toThrow();
  });
});
