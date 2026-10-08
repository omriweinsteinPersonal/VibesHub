import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ path: string[] }> };

const forwardRequestHeaders = [
  'accept',
  'authorization',
  'content-type',
  'idempotency-key',
  'if-match',
] as const;

const forwardResponseHeaders = ['cache-control', 'content-type', 'etag'] as const;

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const apiBaseUrl = (
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'https://vibeshub-api.vercel.app'
  ).replace(/\/$/u, '');
  const target = `${apiBaseUrl}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  const headers = new Headers();

  for (const name of forwardRequestHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const response = await fetch(target, {
      body:
        request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      cache: 'no-store',
      duplex: 'half',
      headers,
      method: request.method,
      redirect: 'manual',
    } as RequestInit);
    const responseHeaders = new Headers({ 'cache-control': 'no-store' });

    for (const name of forwardResponseHeaders) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    return new Response(response.body, {
      headers: responseHeaders,
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      {
        detail: 'The update could not reach the service. Please try again.',
        title: 'Service unavailable',
      },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
