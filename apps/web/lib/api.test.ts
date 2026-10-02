import { afterEach, describe, expect, it, vi } from 'vitest';

import { publicApiRequest } from './api.js';

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
});
