import { afterEach, describe, expect, it, vi } from 'vitest';

import { getBillingSummary } from './billing';

vi.mock('./supabase-browser', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { access_token: 'test-token' } } }),
    },
  }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('web billing', () => {
  it('uses one version prefix and an authenticated request', async () => {
    vi.stubGlobal('window', {});
    const summary = {
      customerId: 'a055b0b3-6bb4-4f9b-98bd-3b018d90a311',
      entitlements: [],
    };
    const request = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: summary })));
    vi.stubGlobal('fetch', request);
    expect(await getBillingSummary()).toEqual(summary);
    const [url, init] = request.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/backend/v1/billing');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-token');
  });
  it('rejects malformed access data instead of treating it as a subscription', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: { entitlements: [{ active: 'true' }] } })),
        ),
    );
    await expect(getBillingSummary()).rejects.toMatchObject({ status: 502 });
  });
});
