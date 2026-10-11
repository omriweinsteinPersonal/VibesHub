import { afterEach, describe, expect, it, vi } from 'vitest';

import { publicApiCollectionRequest, publicApiRequest } from './api.js';

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalFetch = globalThis.fetch;

afterEach(() => {
  process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('publicApiRequest', () => {
  it('works during server rendering without a browser window', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { available: true } }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;

    await expect(publicApiRequest<{ available: boolean }>('/health')).resolves.toEqual({
      available: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/v1/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('turns a plain-text server failure into a useful API error', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('An error occurred while saving the brand.', { status: 500 }),
      );

    await expect(publicApiRequest('/brands')).rejects.toEqual(
      expect.objectContaining({
        message: 'An error occurred while saving the brand.',
        status: 500,
      }),
    );
  });

  it('does not expose JSON parsing syntax errors for malformed success responses', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('not json'));

    await expect(publicApiRequest('/health')).rejects.toEqual(
      expect.objectContaining({
        message: 'The server returned an invalid response. Please try again.',
        status: 502,
      }),
    );
  });

  it('handles non-JSON collection failures consistently', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('Service temporarily unavailable', { status: 503 }),
      );

    await expect(publicApiCollectionRequest('/creators')).rejects.toEqual(
      expect.objectContaining({
        message: 'Service temporarily unavailable',
        status: 503,
      }),
    );
  });
});
