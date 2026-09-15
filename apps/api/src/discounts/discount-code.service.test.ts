import { describe, expect, it, vi } from 'vitest';

import type { CreatorDiscountCode } from '@vibeshub/contracts';

import { DiscountCodeService } from './discount-code.service.js';

const discountCode: CreatorDiscountCode = {
  code: 'NOA10',
  details: {
    direction: 'rtl',
    language: 'he',
    value: 'עשרה אחוזי הנחה באתר',
  },
  expiresAt: '2026-09-01T00:00:00.000Z',
  id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
  label: '10% off',
  lastVerifiedAt: null,
  lifecycle: 'draft',
  merchantHostname: 'shop.example.com',
  merchantName: 'shop.example.com',
  merchantUrl: 'https://shop.example.com',
  startsAt: null,
  updatedAt: '2026-08-07T10:00:00.000Z',
  verificationStatus: 'unverified',
  version: 1,
};

describe('DiscountCodeService', () => {
  it('publishes an unexpired code through creator confirmation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T12:00:00.000Z'));
    const published: CreatorDiscountCode = {
      ...discountCode,
      lastVerifiedAt: '2026-08-07T10:05:00.000Z',
      lifecycle: 'published',
      verificationStatus: 'creator_confirmed',
      version: 2,
    };
    const repository = {
      confirmOwned: vi.fn().mockResolvedValue(published),
      findOwned: vi.fn().mockResolvedValue(discountCode),
    };
    const service = new DiscountCodeService(repository as never);

    try {
      await expect(service.confirm(discountCode.id, 'user-id', 1)).resolves.toEqual(
        published,
      );
      expect(repository.confirmOwned).toHaveBeenCalledWith(discountCode.id, 'user-id', 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('requires the loaded version before editing', async () => {
    const repository = { findOwned: vi.fn().mockResolvedValue(discountCode) };
    const service = new DiscountCodeService(repository as never);

    await expect(
      service.update(discountCode.id, 'user-id', 2, { label: 'Updated' }),
    ).rejects.toMatchObject({ response: { code: 'PRECONDITION_FAILED' } });
  });

  it('allows only published codes to be hidden', async () => {
    const repository = {
      findOwned: vi.fn().mockResolvedValue(discountCode),
      transitionOwned: vi.fn(),
    };
    const service = new DiscountCodeService(repository as never);

    await expect(service.hide(discountCode.id, 'user-id', 1)).rejects.toMatchObject({
      response: { code: 'INVALID_STATE_TRANSITION' },
    });
    expect(repository.transitionOwned).not.toHaveBeenCalled();
  });
});
