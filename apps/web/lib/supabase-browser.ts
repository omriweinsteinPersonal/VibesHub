import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabasePublicConfig } from './config';

let browserClient: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const { anonKey, url } = getSupabasePublicConfig();
    browserClient = createBrowserClient(url, anonKey);
  }
  return browserClient;
}
