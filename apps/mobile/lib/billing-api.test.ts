import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getBillingSummary } from './api';

vi.mock('./supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { access_token: 'test-access' } } }),
    },
  }),
}));
beforeEach(() => vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://api.example.test'));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('native billing API', () => {
  it('uses the authenticated billing endpoint and validates its data', async () => {
    const summary = {
      customerId: 'a055b0b3-6bb4-4f9b-98bd-3b018d90a311',
      entitlements: [],
    };
    const request = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: summary })));
    vi.stubGlobal('fetch', request);
    expect(await getBillingSummary()).toEqual(summary);
    expect(request).toHaveBeenCalledWith(
      'https://api.example.test/v1/billing',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-access' },
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it.each(['not json', JSON.stringify({ data: { entitlements: [{ active: 'true' }] } })])(
    'reports invalid billing responses without parsing errors',
    async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
      await expect(getBillingSummary()).rejects.toMatchObject({
        status: 502,
        message: expect.stringContaining('could not be verified'),
      });
    },
  );
  it('times out a stalled request so the screen can recover', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      ),
    );
    const result = expect(getBillingSummary()).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(20_000);
    await result;
  });
});
