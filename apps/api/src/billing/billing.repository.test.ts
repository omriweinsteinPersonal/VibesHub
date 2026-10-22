import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { BillingRepository } from './billing.repository.js';

function fixture(
  active: { id: string; expiresAt: string } | null,
  options: { stale?: boolean; duplicate?: boolean } = {},
) {
  const rawBody = Buffer.from('{"test":"billing"}');
  const queries: { text: string; values: unknown[] }[] = [];
  const sql = Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join('?').replace(/\s+/g, ' ').trim();
      queries.push({ text, values });
      if (text.startsWith('insert into ops.webhook_receipts'))
        return [
          {
            payloadHash: createHash('sha256').update(rawBody).digest('hex'),
            status: 'processed',
            attemptCount: options.duplicate ? 2 : 1,
          },
        ];
      if (text.includes('from billing.accounts')) return [{ userId: 'user-1' }];
      if (text.startsWith('insert into billing.subscriptions'))
        return options.stale ? [] : [{ id: 'expiring-ios-subscription' }];
      if (text.includes('from billing.subscriptions')) return active ? [active] : [];
      return [];
    }),
    { array: (items: string[]) => items },
  );
  const repository = new BillingRepository({
    sql: { begin: (run: (tx: typeof sql) => unknown) => run(sql) },
  } as never);
  const input = {
    allowedEnvironment: 'sandbox' as const,
    entitlementId: 'creator_pro',
    rawBody,
    event: {
      api_version: '1.0',
      id: 'event-1',
      app_user_id: 'opaque-id',
      entitlement_ids: ['creator_pro'],
      environment: 'SANDBOX' as const,
      type: 'EXPIRATION',
      event_timestamp_ms: 1800000000000,
      expiration_at_ms: 1800000000000,
      original_transaction_id: 'ios-transaction',
      product_id: 'swavii_creator_pro_monthly',
      store: 'APP_STORE',
    },
  };
  return { repository, input, queries };
}

describe('billing subscription reconciliation', () => {
  it('keeps another active store subscription when iOS expires', async () => {
    const active = {
      id: 'active-android-subscription',
      expiresAt: '2027-03-01T00:00:00Z',
    };
    const { repository, input, queries } = fixture(active);
    expect(await repository.processRevenueCatEvent(input)).toBe('processed');
    const write = queries.find((query) =>
      query.text.startsWith('insert into billing.entitlements'),
    )!;
    expect(write.values.slice(0, 5)).toEqual([
      'user-1',
      'creator_pro',
      true,
      active.id,
      active.expiresAt,
    ]);
    expect(
      queries.find((query) => query.text.includes('from billing.accounts'))?.text,
    ).toContain('for update');
  });
  it('removes access once no current subscription remains', async () => {
    const { repository, input, queries } = fixture(null);
    await repository.processRevenueCatEvent(input);
    const write = queries.find((query) =>
      query.text.startsWith('insert into billing.entitlements'),
    )!;
    expect(write.values[2]).toBe(false);
  });
  it('does not let a scheduled product change grant access', async () => {
    const { repository, input, queries } = fixture(null);
    expect(
      await repository.processRevenueCatEvent({
        ...input,
        event: { ...input.event, type: 'PRODUCT_CHANGE' },
      }),
    ).toBe('ignored');
    expect(
      queries.some((query) => query.text.startsWith('insert into billing.entitlements')),
    ).toBe(false);
  });
  it.each([{ stale: true }, { duplicate: true }])(
    'leaves access unchanged for an old/repeated event: %o',
    async (options) => {
      const { repository, input, queries } = fixture(null, options);
      await repository.processRevenueCatEvent(input);
      expect(
        queries.some((query) =>
          query.text.startsWith('insert into billing.entitlements'),
        ),
      ).toBe(false);
    },
  );
  it('ignores the other billing environment', async () => {
    const { repository, input, queries } = fixture(null);
    expect(
      await repository.processRevenueCatEvent({
        ...input,
        allowedEnvironment: 'production',
      }),
    ).toBe('ignored');
    expect(
      queries.some((query) => query.text.startsWith('insert into billing.subscriptions')),
    ).toBe(false);
  });
});
