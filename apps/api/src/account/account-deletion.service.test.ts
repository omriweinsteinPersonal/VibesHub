import { describe, expect, it, vi } from 'vitest';

import { AccountDeletionService } from './account-deletion.service.js';

describe('AccountDeletionService', () => {
  it('deletes the auth identity and cleans up orphaned account media', async () => {
    const auth = { deleteUser: vi.fn().mockResolvedValue(undefined) };
    const apple = { revokeAuthorizationCode: vi.fn() };
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
      apple as never,
      media as never,
      storage as never,
    );

    await service.deleteAccount('user-id', { providers: ['google'] });

    expect(media.listOwnedIds).toHaveBeenCalledWith('user-id');
    expect(auth.deleteUser).toHaveBeenCalledWith('user-id');
    expect(apple.revokeAuthorizationCode).not.toHaveBeenCalled();
    expect(media.deleteUnreferenced).toHaveBeenCalledWith(['asset-id']);
    expect(storage.removeAccountAssets).toHaveBeenCalledWith([
      { mediaKind: 'recommendation_image', objectPath: 'user/image.webp' },
    ]);
  });

  it('does not hide an identity deletion failure', async () => {
    const auth = { deleteUser: vi.fn().mockRejectedValue(new Error('auth unavailable')) };
    const apple = { revokeAuthorizationCode: vi.fn() };
    const media = {
      deleteUnreferenced: vi.fn(),
      listOwnedIds: vi.fn().mockResolvedValue([]),
    };
    const storage = { removeAccountAssets: vi.fn() };
    const service = new AccountDeletionService(
      auth as never,
      apple as never,
      media as never,
      storage as never,
    );

    await expect(
      service.deleteAccount('user-id', { providers: ['google'] }),
    ).rejects.toThrow('auth unavailable');
    expect(media.deleteUnreferenced).not.toHaveBeenCalled();
    expect(storage.removeAccountAssets).not.toHaveBeenCalled();
  });

  it('revokes Apple authorization before deleting an Apple account', async () => {
    const order: string[] = [];
    const auth = {
      deleteUser: vi.fn().mockImplementation(() => {
        order.push('delete');
      }),
    };
    const apple = {
      revokeAuthorizationCode: vi.fn().mockImplementation(() => {
        order.push('revoke');
      }),
    };
    const media = {
      deleteUnreferenced: vi.fn(),
      listOwnedIds: vi.fn().mockResolvedValue([]),
    };
    const storage = { removeAccountAssets: vi.fn() };
    const service = new AccountDeletionService(
      auth as never,
      apple as never,
      media as never,
      storage as never,
    );

    await service.deleteAccount('user-id', {
      appleAuthorizationCode: 'one-time-code',
      providers: ['apple'],
    });

    expect(apple.revokeAuthorizationCode).toHaveBeenCalledWith('one-time-code');
    expect(order).toEqual(['revoke', 'delete']);
  });

  it('requires fresh Apple authorization for an Apple account', async () => {
    const auth = { deleteUser: vi.fn() };
    const apple = { revokeAuthorizationCode: vi.fn() };
    const media = {
      deleteUnreferenced: vi.fn(),
      listOwnedIds: vi.fn().mockResolvedValue([]),
    };
    const storage = { removeAccountAssets: vi.fn() };
    const service = new AccountDeletionService(
      auth as never,
      apple as never,
      media as never,
      storage as never,
    );

    await expect(
      service.deleteAccount('user-id', { providers: ['apple'] }),
    ).rejects.toMatchObject({ status: 400 });
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });
});
