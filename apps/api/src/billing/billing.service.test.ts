import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BillingRepository } from './billing.repository.js';
import { BillingService } from './billing.service.js';

afterEach(() => vi.unstubAllEnvs());

describe('BillingService', () => {
  it('verifies and processes a sandbox entitlement event', async () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        api_version: '1.0',
        event: {
          app_user_id: '019d0000-0000-7000-8000-000000000001',
          entitlement_ids: ['creator_pro'],
          environment: 'SANDBOX',
          event_timestamp_ms: 1_800_000_000_000,
          expiration_at_ms: 1_802_592_000_000,
          id: 'event-1',
          original_transaction_id: 'test-transaction-1',
          product_id: 'creator-pro-monthly',
          store: 'TEST_STORE',
          type: 'INITIAL_PURCHASE',
        },
      }),
    );
    const billing = {
      processRevenueCatEvent: vi.fn().mockResolvedValue('processed'),
    };
    const verifier = { verify: vi.fn().mockReturnValue(rawBody) };
    const service = new BillingService(billing as unknown as BillingRepository, verifier);

    await expect(
      service.handleRevenueCatWebhook({
        authorization: 'Bearer secret',
        rawBody,
        signature: 'signature',
      }),
    ).resolves.toBe('processed');
    expect(billing.processRevenueCatEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedEnvironment: 'sandbox',
        entitlementId: 'creator_pro',
        rawBody,
      }),
    );
  });

  it('rejects malformed JSON after signature verification', async () => {
    const rawBody = Buffer.from('not-json');
    const verifier = { verify: vi.fn().mockReturnValue(rawBody) };
    const service = new BillingService({} as BillingRepository, verifier);

    await expect(
      service.handleRevenueCatWebhook({
        authorization: 'Bearer secret',
        rawBody,
        signature: 'signature',
      }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_WEBHOOK_BODY' } });
  });
});
