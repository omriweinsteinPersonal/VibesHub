import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return response;

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        for (const cookie of cookies) request.cookies.set(cookie.name, cookie.value);
        response = NextResponse.next({ request });
        for (const cookie of cookies)
          response.cookies.set(cookie.name, cookie.value, cookie.options);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  if (isProtectedPath(request.nextUrl.pathname) && !data?.claims) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = '/auth';
    signInUrl.search = '';
    signInUrl.searchParams.set('mode', 'login');
    signInUrl.searchParams.set(
      'next',
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(signInUrl);
  }
  return response;
}

export const config = {
  matcher: [
    '/account/:path*',
    '/admin/:path*',
    '/creator/:path*',
    '/creator-home',
    '/dashboard',
    '/analytics',
  ],
};

function isProtectedPath(pathname: string): boolean {
  if (
    pathname === '/account' ||
    pathname.startsWith('/account/') ||
    pathname === '/creator-home' ||
    pathname === '/dashboard' ||
    pathname === '/analytics' ||
    pathname.startsWith('/admin/')
  ) {
    return true;
  }

  return [
    '/creator/apply',
    '/creator/analytics',
    '/creator/discount-codes',
    '/creator/profile',
    '/creator/recommendations',
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
