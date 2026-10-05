export type AuthCallbackParameters = {
  accessToken?: string;
  code?: string;
  error?: string;
  refreshToken?: string;
};

export function parseAuthCallback(url: string): AuthCallbackParameters {
  const parsed = new URL(url);
  const parameters = new URLSearchParams(parsed.search);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));

  fragment.forEach((value, key) => parameters.set(key, value));

  return {
    accessToken: parameters.get('access_token') ?? undefined,
    code: parameters.get('code') ?? undefined,
    error: parameters.get('error_description') ?? parameters.get('error') ?? undefined,
    refreshToken: parameters.get('refresh_token') ?? undefined,
  };
}
