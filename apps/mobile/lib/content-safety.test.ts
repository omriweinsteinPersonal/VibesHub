import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getContentSafetyInstallationId,
  getHiddenCreatorIds,
  hideCreator,
} from './content-safety';

const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

const crypto = vi.hoisted(() => ({
  randomUUID: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: secureStore.getItemAsync,
  setItemAsync: secureStore.setItemAsync,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: crypto.randomUUID,
}));

describe('getHiddenCreatorIds', () => {
  beforeEach(() => {
    secureStore.getItemAsync.mockReset();
    secureStore.setItemAsync.mockReset();
    crypto.randomUUID.mockReset();
  });

  it('returns stored creator ids', async () => {
    secureStore.getItemAsync.mockResolvedValue('["creator-a","creator-b",42]');

    await expect(getHiddenCreatorIds()).resolves.toEqual(
      new Set(['creator-a', 'creator-b']),
    );
  });

  it('keeps storefronts available when secure storage cannot be read', async () => {
    secureStore.getItemAsync.mockRejectedValue(new Error('Keychain unavailable'));

    await expect(getHiddenCreatorIds()).resolves.toEqual(new Set());
  });

  it('keeps hide preferences usable for the current session without keychain access', async () => {
    secureStore.getItemAsync.mockRejectedValue(new Error('Keychain unavailable'));
    secureStore.setItemAsync.mockRejectedValue(new Error('Keychain unavailable'));

    await hideCreator('creator-local');

    await expect(getHiddenCreatorIds()).resolves.toContain('creator-local');
  });

  it('provides a stable report installation id without keychain access', async () => {
    secureStore.getItemAsync.mockRejectedValue(new Error('Keychain unavailable'));
    secureStore.setItemAsync.mockRejectedValue(new Error('Keychain unavailable'));
    crypto.randomUUID.mockReturnValue('temporary-installation-id');

    await expect(getContentSafetyInstallationId()).resolves.toBe(
      'temporary-installation-id',
    );
    await expect(getContentSafetyInstallationId()).resolves.toBe(
      'temporary-installation-id',
    );
  });
});
