import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import {
  destinationForAccount,
  safeInternalPath,
  type AuthenticatedAccount,
} from '../../../lib/account-destination';
import { getApiUrl, getSupabasePublicConfig } from '../../../lib/config';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const requestedNext = safeInternalPath(
    requestUrl.searchParams.get('next'),
    '/creator-home',
  );

  if (!code)
    return NextResponse.redirect(
      new URL('/auth?mode=login&error=missing_code', request.url),
    );
  const { publishableKey, url } = getSupabasePublicConfig();
  const cookiesToSet: Array<{
    name: string;
    options: Parameters<NextResponse['cookies']['set']>[2];
    value: string;
  }> = [];
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookiesToSet.push(...cookies);
      },
    },
  });
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    return NextResponse.redirect(
      new URL('/auth?mode=login&error=callback_failed', request.url),
    );
  }

  let destination = `/auth/continue?next=${encodeURIComponent(requestedNext)}`;
  try {
    const accountResponse = await fetch(`${getApiUrl()}/v1/me`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${data.session.access_token}` },
    });
    if (accountResponse.ok) {
      const body = (await accountResponse.json()) as { data?: AuthenticatedAccount };
      if (body.data) {
        destination = destinationForAccount(body.data, requestedNext);
      }
    }
  } catch {
    // The branded client continuation remains a resilient fallback when the API is down.
  }

  const response = NextResponse.redirect(new URL(destination, request.url));
  for (const cookie of cookiesToSet) {
    if (cookie.options) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    } else {
      response.cookies.set(cookie.name, cookie.value);
    }
  }
  return response;
}
