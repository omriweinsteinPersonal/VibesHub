import { describe, expect, it } from 'vitest';

import { parseAuthCallback } from './auth-callback';

describe('parseAuthCallback', () => {
  it('parses PKCE authorization codes', () => {
    expect(parseAuthCallback('swavii://auth/callback?code=abc')).toEqual({
      accessToken: undefined,
      code: 'abc',
      error: undefined,
      refreshToken: undefined,
    });
  });

  it('parses implicit tokens from the URL fragment', () => {
    expect(
      parseAuthCallback(
        'swavii://auth/callback#access_token=access&refresh_token=refresh',
      ),
    ).toMatchObject({ accessToken: 'access', refreshToken: 'refresh' });
  });

  it('prefers a useful provider error description', () => {
    expect(
      parseAuthCallback(
        'swavii://auth/callback?error=access_denied&error_description=User%20cancelled',
      ).error,
    ).toBe('User cancelled');
  });
});
