import { describe, expect, it, vi } from 'vitest';

import { CreatorProfileService } from './creator-profile.service.js';

const profile = {
  avatar: null,
  bioHe: 'המלצות על טיפוח ויופי',
  displayName: 'Noa Levi',
  handle: 'noa-levi',
  id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
  primaryCategory: {
    id: '01989f72-07e4-7f32-9b42-1ba55d4ca011',
    name: 'Beauty',
    slug: 'beauty',
  },
  socialLinks: [],
  version: 2,
};

describe('CreatorProfileService', () => {
  it('returns an approved creator profile', async () => {
    const repository = { findOwned: vi.fn().mockResolvedValue(profile) };
    const service = new CreatorProfileService(repository as never);

    await expect(service.get('user-id')).resolves.toEqual(profile);
  });

  it('rejects stale profile updates', async () => {
    const repository = {
      updateOwned: vi
        .fn()
        .mockResolvedValue({ actualVersion: 3, kind: 'version_conflict' }),
    };
    const service = new CreatorProfileService(repository as never);

    await expect(
      service.update('user-id', 2, { displayName: 'Noa Cohen' }),
    ).rejects.toMatchObject({ response: { code: 'PRECONDITION_FAILED' } });
  });

  it('rejects an avatar that is not owned and ready', async () => {
    const repository = {
      updateOwned: vi.fn().mockResolvedValue({ kind: 'invalid_avatar' }),
    };
    const service = new CreatorProfileService(repository as never);

    await expect(
      service.update('user-id', 2, {
        avatarAssetId: '01989f72-07e4-7f32-9b42-1ba55d4ca012',
      }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_FAILED' } });
  });

  it('reports whether a public storefront handle is available', async () => {
    const repository = { isHandleAvailable: vi.fn().mockResolvedValue(true) };
    const service = new CreatorProfileService(repository as never);

    await expect(service.handleAvailability('user-id', 'noa-picks')).resolves.toEqual({
      available: true,
      handle: 'noa-picks',
    });
  });

  it('translates a raced unique handle update into a conflict', async () => {
    const repository = {
      updateOwned: vi.fn().mockRejectedValue({ code: '23505' }),
    };
    const service = new CreatorProfileService(repository as never);

    await expect(
      service.update('user-id', 2, { handle: 'already-taken' }),
    ).rejects.toMatchObject({ response: { code: 'RESOURCE_CONFLICT' } });
  });
});
