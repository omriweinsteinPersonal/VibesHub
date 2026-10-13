import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHiddenCreatorIds } from './content-safety';

const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: secureStore.getItemAsync,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(),
}));

describe('getHiddenCreatorIds', () => {
  beforeEach(() => {
    secureStore.getItemAsync.mockReset();
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
});
