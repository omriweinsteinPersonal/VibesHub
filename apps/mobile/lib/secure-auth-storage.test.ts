import { describe, expect, it } from 'vitest';

import { createSecureAuthStorage, type NativeKeyValueStore } from './secure-auth-storage';

function createNativeStore(values = new Map<string, string>()): NativeKeyValueStore {
  return {
    async deleteItemAsync(key) {
      values.delete(key);
    },
    async getItemAsync(key) {
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      values.set(key, value);
    },
  };
}

describe('secure auth storage', () => {
  it('restores a large persisted session after the storage adapter is recreated', async () => {
    const persistedValues = new Map<string, string>();
    const session = JSON.stringify({
      access_token: 'a'.repeat(4_000),
      refresh_token: 'r',
    });

    await createSecureAuthStorage(createNativeStore(persistedValues)).setItem(
      'swavii-auth',
      session,
    );

    const storageAfterRestart = createSecureAuthStorage(
      createNativeStore(persistedValues),
    );
    await expect(storageAfterRestart.getItem('swavii-auth')).resolves.toBe(session);
  });

  it('removes every persisted chunk when the user signs out', async () => {
    const persistedValues = new Map<string, string>();
    const storage = createSecureAuthStorage(createNativeStore(persistedValues));
    await storage.setItem('swavii-auth', 'session'.repeat(1_000));

    await storage.removeItem('swavii-auth');

    await expect(storage.getItem('swavii-auth')).resolves.toBeNull();
    expect(persistedValues.size).toBe(0);
  });

  it('uses the development fallback when a legacy-key read fails', async () => {
    const nativeStore = createNativeStore();
    nativeStore.getItemAsync = async (key) => {
      if (key.endsWith('.count')) return null;
      throw new Error('secure storage unavailable');
    };
    const storage = createSecureAuthStorage(
      nativeStore,
      new Map([['swavii-auth', 'in-memory-session']]),
    );

    await expect(storage.getItem('swavii-auth')).resolves.toBe('in-memory-session');
  });
});
