import { generateKeyPairSync } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppleAuthorizationGateway } from './apple-authorization.gateway.js';

describe('AppleAuthorizationGateway', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('exchanges the fresh code and revokes the returned refresh token', async () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    vi.stubEnv('APPLE_CLIENT_ID', 'com.swavii.app');
    vi.stubEnv('APPLE_KEY_ID', 'KEY123');
    vi.stubEnv(
      'APPLE_PRIVATE_KEY',
      privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    );
    vi.stubEnv('APPLE_TEAM_ID', 'TEAM123');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({ refresh_token: 'refresh-token' }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await new AppleAuthorizationGateway().revokeAuthorizationCode('fresh-code');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://appleid.apple.com/auth/token',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://appleid.apple.com/auth/revoke',
      expect.objectContaining({ method: 'POST' }),
    );
    const revokeRequest = fetchMock.mock.calls[1]?.[1] as { body: URLSearchParams };
    expect(revokeRequest.body.get('token')).toBe('refresh-token');
    expect(revokeRequest.body.get('token_type_hint')).toBe('refresh_token');
  });

  it('surfaces the Apple response status when the code exchange fails', async () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    vi.stubEnv('APPLE_CLIENT_ID', 'com.swavii.app');
    vi.stubEnv('APPLE_KEY_ID', 'KEY123');
    vi.stubEnv(
      'APPLE_PRIVATE_KEY',
      privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    );
    vi.stubEnv('APPLE_TEAM_ID', 'TEAM123');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ error: 'invalid_grant' }),
        ok: false,
        status: 400,
      }),
    );

    await expect(
      new AppleAuthorizationGateway().revokeAuthorizationCode('expired-code'),
    ).rejects.toThrow('Apple authorization exchange failed (400)');
  });
});
