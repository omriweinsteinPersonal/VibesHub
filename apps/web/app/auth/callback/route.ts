import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { getSupabasePublicConfig } from '../../../lib/config';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const requestedNext = requestUrl.searchParams.get('next');
  const next =
    requestedNext?.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/account';
  const response = NextResponse.redirect(new URL(next, request.url));

  if (!code)
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  const { anonKey, url } = getSupabasePublicConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        for (const cookie of cookies)
          response.cookies.set(cookie.name, cookie.value, cookie.options);
      },
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error
    ? NextResponse.redirect(new URL('/login?error=callback_failed', request.url))
    : response;
}
