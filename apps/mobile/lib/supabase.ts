import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import { createSecureAuthStorage } from './secure-auth-storage';

const secureStorage = createSecureAuthStorage(
  SecureStore,
  __DEV__ ? new Map<string, string>() : undefined,
);

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey)
    throw new Error('Supabase public environment variables are not configured');
  client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: Platform.OS === 'web' ? undefined : secureStorage,
    },
  });
  if (Platform.OS !== 'web') {
    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }
  return client;
}
