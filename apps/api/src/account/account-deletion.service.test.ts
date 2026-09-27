import { describe, expect, it, vi } from 'vitest';

import { AccountDeletionService } from './account-deletion.service.js';

describe('AccountDeletionService', () => {
  it('deletes the auth identity and cleans up orphaned account media', async () => {
    const auth = { deleteUser: vi.fn().mockResolvedValue(undefined) };
    const media = {
      deleteUnreferenced: vi
        .fn()
        .mockResolvedValue([
          { mediaKind: 'recommendation_image', objectPath: 'user/image.webp' },
        ]),
      listOwnedIds: vi.fn().mockResolvedValue(['asset-id']),
    };
    const storage = { removeAccountAssets: vi.fn().mockResolvedValue(undefined) };
    const service = new AccountDeletionService(
      auth as never,
      media as never,
      storage as never,
    );

    await service.deleteAccount('user-id');

    expect(media.listOwnedIds).toHaveBeenCalledWith('user-id');
    expect(auth.deleteUser).toHaveBeenCalledWith('user-id');
    expect(media.deleteUnreferenced).toHaveBeenCalledWith(['asset-id']);
    expect(storage.removeAccountAssets).toHaveBeenCalledWith([
      { mediaKind: 'recommendation_image', objectPath: 'user/image.webp' },
    ]);
  });

  it('does not hide an identity deletion failure', async () => {
    const auth = { deleteUser: vi.fn().mockRejectedValue(new Error('auth unavailable')) };
    const media = {
      deleteUnreferenced: vi.fn(),
      listOwnedIds: vi.fn().mockResolvedValue([]),
    };
    const storage = { removeAccountAssets: vi.fn() };
    const service = new AccountDeletionService(
      auth as never,
      media as never,
      storage as never,
    );

    await expect(service.deleteAccount('user-id')).rejects.toThrow('auth unavailable');
    expect(media.deleteUnreferenced).not.toHaveBeenCalled();
    expect(storage.removeAccountAssets).not.toHaveBeenCalled();
  });
});
