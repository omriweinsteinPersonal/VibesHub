import { describe, expect, it } from 'vitest';

import { assertNativeOAuthRedirect } from './oauth-redirect';

const nativeRedirect = 'swavii://auth/callback';

describe('assertNativeOAuthRedirect', () => {
  it('accepts an authorization URL that returns to the native app', () => {
    expect(() =>
      assertNativeOAuthRedirect(
        `https://example.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(nativeRedirect)}`,
        nativeRedirect,
      ),
    ).not.toThrow();
  });

  it('rejects a fallback to the public website', () => {
    expect(() =>
      assertNativeOAuthRedirect(
        'https://example.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fswavii.com',
        nativeRedirect,
      ),
    ).toThrow('not configured to return to the Swavii app');
  });

  it('rejects malformed and missing redirect URLs', () => {
    expect(() => assertNativeOAuthRedirect('not a URL', nativeRedirect)).toThrow(
      'invalid authorization URL',
    );
    expect(() =>
      assertNativeOAuthRedirect(
        'https://example.supabase.co/auth/v1/authorize?provider=google',
        nativeRedirect,
      ),
    ).toThrow('not configured to return to the Swavii app');
  });
});
