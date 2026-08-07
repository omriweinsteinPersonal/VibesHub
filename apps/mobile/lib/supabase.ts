import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1_800;

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const countValue = await SecureStore.getItemAsync(`${key}:count`);
    if (!countValue) return SecureStore.getItemAsync(key);
    const count = Number(countValue);
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(`${key}:${index}`),
      ),
    );
    return chunks.every((chunk) => chunk !== null) ? chunks.join('') : null;
  },
  async removeItem(key: string): Promise<void> {
    const countValue = await SecureStore.getItemAsync(`${key}:count`);
    const count = Number(countValue ?? 0);
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      SecureStore.deleteItemAsync(`${key}:count`),
      ...Array.from({ length: count }, (_, index) =>
        SecureStore.deleteItemAsync(`${key}:${index}`),
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
      chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}:${index}`, chunk)),
    );
    await SecureStore.setItemAsync(`${key}:count`, String(chunks.length));
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
      storage: secureStorage,
    },
  });
  return client;
}
