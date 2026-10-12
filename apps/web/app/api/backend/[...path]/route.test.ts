import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PATCH } from './route.js';

const originalFetch = globalThis.fetch;
const originalApiInternalUrl = process.env.API_INTERNAL_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.API_INTERNAL_URL = originalApiInternalUrl;
  vi.restoreAllMocks();
});

describe('backend proxy', () => {
  it('preserves the private version header and forwards a buffered mutation body', async () => {
    process.env.API_INTERNAL_URL = 'https://api.example.test';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { version: 4 } }), {
        headers: { 'content-type': 'application/json', etag: '"4"' },
      }),
    );
    globalThis.fetch = fetchMock;
    const request = new NextRequest(
      'https://swavii.com/api/backend/v1/creator/brands/brand-id',
      {
        body: JSON.stringify({ name: 'Updated brand' }),
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
          'x-swavii-if-match': '"3"',
        },
        method: 'PATCH',
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ path: ['v1', 'creator', 'brands', 'brand-id'] }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe('https://api.example.test/v1/creator/brands/brand-id');
    expect(headers.get('if-match')).toBeNull();
    expect(headers.get('x-swavii-if-match')).toBe('"3"');
    expect(init.body).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe(
      JSON.stringify({ name: 'Updated brand' }),
    );
  });
});
