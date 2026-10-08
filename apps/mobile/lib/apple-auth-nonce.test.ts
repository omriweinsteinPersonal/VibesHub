import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAppleAuthNonce } from './apple-auth-nonce';

const crypto = vi.hoisted(() => ({
  digestStringAsync: vi.fn(),
  randomUUID: vi.fn(),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: crypto.digestStringAsync,
  randomUUID: crypto.randomUUID,
}));

describe('createAppleAuthNonce', () => {
  beforeEach(() => {
    crypto.randomUUID.mockReset();
    crypto.digestStringAsync.mockReset();
  });

  it('keeps the raw nonce for Supabase and hashes it for Apple', async () => {
    crypto.randomUUID.mockReturnValue('one-time-nonce');
    crypto.digestStringAsync.mockResolvedValue('hashed-one-time-nonce');

    await expect(createAppleAuthNonce()).resolves.toEqual({
      hashed: 'hashed-one-time-nonce',
      raw: 'one-time-nonce',
    });
    expect(crypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', 'one-time-nonce');
  });
});
