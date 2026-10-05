import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const CHUNK_SIZE = 1_800;

function chunkKey(key: string, suffix: string | number): string {
  return `${key}.${suffix}`;
}

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const countValue = await SecureStore.getItemAsync(chunkKey(key, 'count'));
    if (!countValue) return SecureStore.getItemAsync(key);
    const count = Number(countValue);
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index)),
      ),
    );
    return chunks.every((chunk) => chunk !== null) ? chunks.join('') : null;
  },
  async removeItem(key: string): Promise<void> {
    const countValue = await SecureStore.getItemAsync(chunkKey(key, 'count'));
    const count = Number(countValue ?? 0);
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      SecureStore.deleteItemAsync(chunkKey(key, 'count')),
      ...Array.from({ length: count }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, index)),
      ),
    ]);
  },
  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);
    const chunks = Array.from(
      { length: Math.ceil(value.length / CHUNK_SIZE) },
      (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    );
    await Promise.all(
      chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)),
    );
    await SecureStore.setItemAsync(chunkKey(key, 'count'), String(chunks.length));
  },
};

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
