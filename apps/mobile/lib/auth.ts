import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { createAppleAuthNonce } from './apple-auth-nonce';
import { parseAuthCallback } from './auth-callback';
import { getSupabaseClient } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export const nativeAuthRedirectUrl = makeRedirectUri({
  path: 'auth/callback',
  scheme: 'swavii',
});

export async function establishSessionFromCallback(url: string): Promise<void> {
  const callback = parseAuthCallback(url);
  if (callback.error) throw new Error(callback.error);

  const supabase = getSupabaseClient();
  if (callback.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
    if (error) throw error;
    return;
  }

  if (callback.accessToken && callback.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: callback.accessToken,
      refresh_token: callback.refreshToken,
    });
    if (error) throw error;
    return;
  }

  throw new Error('The sign-in response did not contain a session.');
}

export async function signInWithGoogle(): Promise<'cancelled' | 'signed-in'> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: nativeAuthRedirectUrl,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Google sign-in could not be started.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, nativeAuthRedirectUrl);
  if (result.type !== 'success') return 'cancelled';
  await establishSessionFromCallback(result.url);
  const { error: profileError } = await supabase.auth.updateUser({
    data: { intended_role: 'creator' },
  });
  if (profileError) throw profileError;
  return 'signed-in';
}

export async function signInWithApple(): Promise<'cancelled' | 'signed-in'> {
  try {
    const nonce = await createAppleAuthNonce();
    const credential = await AppleAuthentication.signInAsync({
      nonce: nonce.hashed,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      throw new Error('Apple did not return a valid identity token.');
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithIdToken({
      nonce: nonce.raw,
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;

    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ');
    const { error: profileError } = await supabase.auth.updateUser({
      data: {
        ...(fullName ? { full_name: fullName } : {}),
        intended_role: 'creator',
      },
    });
    if (profileError) throw profileError;
    return 'signed-in';
  } catch (cause) {
    if (
      cause instanceof Error &&
      'code' in cause &&
      cause.code === 'ERR_REQUEST_CANCELED'
    ) {
      return 'cancelled';
    }
    throw cause;
  }
}

export async function getAppleAccountDeletionAuthorizationCode(): Promise<string> {
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) throw new Error('Apple authorization is unavailable on this device.');

  const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
  if (!credential.authorizationCode) {
    throw new Error('Apple did not return the authorization needed for deletion.');
  }
  return credential.authorizationCode;
}
