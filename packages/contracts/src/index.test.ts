import { describe, expect, it } from 'vitest';

import {
  creatorCardSchema,
  creatorApplicationInputSchema,
  creatorDirectoryQuerySchema,
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

  it('normalizes bounded creator directory filters', () => {
    expect(
      creatorDirectoryQuerySchema.parse({
        category: ' Beauty ',
        limit: '24',
        q: ' NOA ',
      }),
    ).toEqual({ category: 'beauty', limit: 24, q: 'noa' });

    expect(() => creatorDirectoryQuerySchema.parse({ limit: '100' })).toThrow();
  });

  it('keeps Hebrew creator copy directional and public fields explicit', () => {
    expect(
      creatorCardSchema.parse({
        bio: { direction: 'rtl', language: 'he', value: 'המלצות אמיתיות' },
        displayName: 'Noa Levi',
        followerCount: 124_000,
        handle: 'noa-levi',
        id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
        primaryCategory: { name: 'Beauty', slug: 'beauty' },
        recommendationCount: 0,
        verificationStatus: 'verified',
      }).verificationStatus,
    ).toBe('verified');
  });
});
