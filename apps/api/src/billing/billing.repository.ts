import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { problem } from '../api-problem.js';
import { Database, type DatabaseClient } from '../database.js';
import type { BillingSummary, RevenueCatWebhookEvent } from './billing.types.js';

interface BillingAccountRow {
  customerId: string;
}

interface EntitlementRow {
  activeUntil: string | null;
  entitlementKey: string;
  isActive: boolean;
}

interface ReceiptRow {
  attemptCount: number;
  payloadHash: string;
  status: 'failed' | 'ignored' | 'processed' | 'received';
}

interface UserRow {
  userId: string;
}

interface SubscriptionRow {
  id: string;
}

export type WebhookProcessingResult = 'duplicate' | 'ignored' | 'processed';

@Injectable()
export class BillingRepository {
  constructor(private readonly database: Database) {}

  async getSummary(userId: string): Promise<BillingSummary> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const [account] = await sql<BillingAccountRow[]>`
        insert into billing.accounts (user_id)
        values (${userId})
        on conflict (user_id) do update set user_id = excluded.user_id
        returning external_customer_id::text as "customerId"
      `;
      if (!account) throw new Error('Billing account could not be created');

      const rows = await sql<EntitlementRow[]>`
        select
          entitlement_key as "entitlementKey",
          (
            is_active
            and (active_until is null or active_until > statement_timestamp())
          ) as "isActive",
          active_until as "activeUntil"
        from billing.entitlements
        where user_id = ${userId}
        order by entitlement_key
      `;
      return {
        customerId: account.customerId,
        entitlements: rows.map((row) => ({
          active: row.isActive,
          expiresAt: row.activeUntil,
          key: row.entitlementKey,
        })),
      };
    });
  }

  async processRevenueCatEvent(input: {
    allowedEnvironment: 'production' | 'sandbox';
    entitlementId: string;
    event: RevenueCatWebhookEvent;
    rawBody: Buffer;
  }): Promise<WebhookProcessingResult> {
    const payloadHash = createHash('sha256').update(input.rawBody).digest('hex');
    const eventEnvironment = normalizeEnvironment(input.event.environment);

    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const receipt = await this.claimReceipt(
        sql,
        input.event.id,
        eventEnvironment,
        payloadHash,
      );
      if (receipt.payloadHash !== payloadHash) {
        throw problem(
          409,
          'WEBHOOK_EVENT_CONFLICT',
          'Webhook event identifier was reused with a different payload',
        );
      }
      if (receipt.attemptCount > 1 && ['processed', 'ignored'].includes(receipt.status)) {
        return 'duplicate';
      }

      if (eventEnvironment !== input.allowedEnvironment) {
        await this.finishReceipt(sql, input.event.id, eventEnvironment, 'ignored');
        return 'ignored';
      }

      const lifecycle = mapLifecycle(input.event.type);
      const entitlementIds = new Set([
        ...(input.event.entitlement_ids ?? []),
        ...(input.event.entitlement_id ? [input.event.entitlement_id] : []),
      ]);
      if (!lifecycle || !entitlementIds.has(input.entitlementId)) {
        await this.finishReceipt(sql, input.event.id, eventEnvironment, 'ignored');
        return 'ignored';
      }

      const identityIds = [
        input.event.app_user_id,
        input.event.original_app_user_id,
        ...(input.event.aliases ?? []),
      ].filter((value): value is string => Boolean(value));
      const users = await sql<UserRow[]>`
        select user_id as "userId"
        from billing.accounts
        where external_customer_id::text = any(${sql.array([...new Set(identityIds)])}::text[])
        limit 2
      `;
      if (users.length !== 1) {
        await this.finishReceipt(sql, input.event.id, eventEnvironment, 'ignored');
        return 'ignored';
      }
      const user = users[0];
      if (!user) throw new Error('Billing identity lookup failed');

      const eventAt = new Date(input.event.event_timestamp_ms).toISOString();
      const expiresAt = timestampToIso(
        input.event.grace_period_expiration_at_ms ?? input.event.expiration_at_ms,
      );
      const providerSubscriptionId =
        input.event.original_transaction_id ??
        input.event.transaction_id ??
        `event:${input.event.id}`;
      const productId =
        input.event.new_product_id ?? input.event.product_id ?? 'temporary_entitlement';
      const [subscription] = await sql<SubscriptionRow[]>`
        insert into billing.subscriptions (
          user_id,
          provider,
          store,
          environment,
          provider_subscription_id,
          product_id,
          status,
          current_period_expires_at,
          cancel_at_period_end,
          last_event_at
        ) values (
          ${user.userId},
          'revenuecat',
          ${normalizeStore(input.event.store)},
          ${eventEnvironment},
          ${providerSubscriptionId},
          ${productId},
          ${lifecycle.status},
          ${expiresAt},
          ${lifecycle.cancelAtPeriodEnd},
          ${eventAt}
        )
        on conflict (provider, environment, provider_subscription_id) do update set
          user_id = excluded.user_id,
          store = excluded.store,
          product_id = excluded.product_id,
          status = excluded.status,
          current_period_expires_at = excluded.current_period_expires_at,
          cancel_at_period_end = excluded.cancel_at_period_end,
          last_event_at = excluded.last_event_at
        where excluded.last_event_at >= billing.subscriptions.last_event_at
        returning id
      `;

      if (subscription) {
        await sql`
          insert into billing.entitlements (
            user_id,
            entitlement_key,
            is_active,
            source_provider,
            source_subscription_id,
            active_until,
            last_event_at
          ) values (
            ${user.userId},
            ${input.entitlementId},
            ${lifecycle.active},
            'revenuecat',
            ${subscription.id},
            ${expiresAt},
            ${eventAt}
          )
          on conflict (user_id, entitlement_key) do update set
            is_active = excluded.is_active,
            source_provider = excluded.source_provider,
            source_subscription_id = excluded.source_subscription_id,
            active_until = excluded.active_until,
            last_event_at = excluded.last_event_at
          where excluded.last_event_at >= billing.entitlements.last_event_at
        `;
      }

      await this.finishReceipt(sql, input.event.id, eventEnvironment, 'processed');
      return 'processed';
    });
  }

  private async claimReceipt(
    sql: DatabaseClient,
    eventId: string,
    environment: 'production' | 'sandbox',
    payloadHash: string,
  ): Promise<ReceiptRow> {
    const [receipt] = await sql<ReceiptRow[]>`
      insert into ops.webhook_receipts (
        provider,
        environment,
        provider_event_id,
        payload_hash
      ) values ('revenuecat', ${environment}, ${eventId}, ${payloadHash})
      on conflict (provider, environment, provider_event_id) do update set
        attempt_count = ops.webhook_receipts.attempt_count + 1
      returning
        payload_hash as "payloadHash",
        status,
        attempt_count as "attemptCount"
    `;
    if (!receipt) throw new Error('Webhook receipt could not be claimed');
    return receipt;
  }

  private async finishReceipt(
    sql: DatabaseClient,
    eventId: string,
    environment: 'production' | 'sandbox',
    status: 'ignored' | 'processed',
  ): Promise<void> {
    await sql`
      update ops.webhook_receipts
      set status = ${status}, processed_at = statement_timestamp(), last_error = null
      where provider = 'revenuecat'
        and environment = ${environment}
        and provider_event_id = ${eventId}
    `;
  }
}

function normalizeEnvironment(
  environment: RevenueCatWebhookEvent['environment'],
): 'production' | 'sandbox' {
  return environment === 'PRODUCTION' ? 'production' : 'sandbox';
}

function normalizeStore(store: RevenueCatWebhookEvent['store']): string {
  switch (store) {
    case 'APP_STORE':
    case 'MAC_APP_STORE':
      return 'app_store';
    case 'PLAY_STORE':
      return 'play_store';
    case 'RC_BILLING':
    case 'STRIPE':
      return 'stripe';
    case 'TEST_STORE':
      return 'test_store';
    default:
      return 'unknown';
  }
}

function mapLifecycle(type: string): {
  active: boolean;
  cancelAtPeriodEnd: boolean;
  status: 'active' | 'canceled' | 'expired' | 'past_due' | 'revoked';
} | null {
  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'PRODUCT_CHANGE':
    case 'REFUND_REVERSED':
    case 'RENEWAL':
    case 'SUBSCRIPTION_EXTENDED':
    case 'TEMPORARY_ENTITLEMENT_GRANT':
    case 'UNCANCELLATION':
      return { active: true, cancelAtPeriodEnd: false, status: 'active' };
    case 'CANCELLATION':
      return { active: true, cancelAtPeriodEnd: true, status: 'canceled' };
    case 'BILLING_ISSUE':
      return { active: true, cancelAtPeriodEnd: false, status: 'past_due' };
    case 'EXPIRATION':
      return { active: false, cancelAtPeriodEnd: false, status: 'expired' };
    case 'REFUND':
      return { active: false, cancelAtPeriodEnd: false, status: 'revoked' };
    default:
      return null;
  }
}

function timestampToIso(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : new Date(value).toISOString();
}
