import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getApiUrl, getSupabasePublicConfig } from './config';

interface AccountSummary {
  creator: { handle: string; id: string } | null;
}

export async function hasCreatorSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const { publishableKey, url } = getSupabasePublicConfig();
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => undefined,
      },
    });
    const { data } = await supabase.auth.getSession();
    if (!data.session) return false;

    const response = await fetch(`${getApiUrl()}/v1/me`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${data.session.access_token}` },
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { data?: AccountSummary };
    return Boolean(body.data?.creator);
  } catch {
    return false;
  }
}
