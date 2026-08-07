import { describe, expect, it, vi } from 'vitest';

import type { ResolvedRedirect } from './redirect.repository.js';
import { RedirectService } from './redirect.service.js';

const activeLink: ResolvedRedirect = {
  creatorId: '01989f72-07e4-7f32-9b42-1ba55d4ca020',
  destinationUrl: 'https://shop.example.com/products/blush?ref=vibeshub',
  hostname: 'shop.example.com',
  id: '01989f72-07e4-7f32-9b42-1ba55d4ca021',
  merchantId: '01989f72-07e4-7f32-9b42-1ba55d4ca022',
  productId: '01989f72-07e4-7f32-9b42-1ba55d4ca023',
  recommendationId: '01989f72-07e4-7f32-9b42-1ba55d4ca024',
};

describe('RedirectService', () => {
  it('resolves a stored destination and records the authoritative click', async () => {
    const repository = {
      findActive: vi.fn().mockResolvedValue(activeLink),
      recordEvent: vi.fn().mockResolvedValue(undefined),
    };
    const service = new RedirectService(repository as never);

    await expect(service.resolve('01989f72-07e4-7f32-9b42-1ba55d4ca025')).resolves.toBe(
      activeLink.destinationUrl,
    );
    expect(repository.recordEvent).toHaveBeenCalledWith(
      activeLink,
      'affiliate.shopClicked.v1',
      undefined,
    );
  });

  it('does not accept malformed public IDs or arbitrary targets', async () => {
    const repository = {
      findActive: vi.fn(),
      recordEvent: vi.fn(),
    };
    const service = new RedirectService(repository as never);

    await expect(service.resolve('https://evil.example')).resolves.toBeNull();
    expect(repository.findActive).not.toHaveBeenCalled();
  });

  it('fails closed when the stored destination no longer matches the allowlist', async () => {
    const repository = {
      findActive: vi.fn().mockResolvedValue({
        ...activeLink,
        hostname: 'other.example.com',
      }),
      recordEvent: vi.fn().mockResolvedValue(undefined),
    };
    const service = new RedirectService(repository as never);

    await expect(
      service.resolve('01989f72-07e4-7f32-9b42-1ba55d4ca025'),
    ).resolves.toBeNull();
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.anything(),
      'affiliate.redirectBlocked.v1',
      'destination_invalid',
    );
  });

  it('still redirects when click recording is unavailable', async () => {
    const repository = {
      findActive: vi.fn().mockResolvedValue(activeLink),
      recordEvent: vi.fn().mockRejectedValue(new Error('database timeout')),
    };
    const service = new RedirectService(repository as never);

    await expect(service.resolve('01989f72-07e4-7f32-9b42-1ba55d4ca025')).resolves.toBe(
      activeLink.destinationUrl,
    );
  });
});
