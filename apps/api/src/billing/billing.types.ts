import { z } from 'zod';

const optionalNullableString = z.string().trim().min(1).nullable().optional();
const optionalNullableInteger = z.number().int().nonnegative().nullable().optional();

export const revenueCatWebhookSchema = z
  .object({
    api_version: z.string(),
    event: z
      .object({
        aliases: z.array(z.string()).optional(),
        app_user_id: optionalNullableString,
        entitlement_id: optionalNullableString,
        entitlement_ids: z.array(z.string()).nullable().optional(),
        environment: z.enum(['SANDBOX', 'PRODUCTION']).nullable().optional(),
        event_timestamp_ms: z.number().int().nonnegative(),
        expiration_at_ms: optionalNullableInteger,
        grace_period_expiration_at_ms: optionalNullableInteger,
        id: z.string().trim().min(1),
        new_product_id: optionalNullableString,
        original_app_user_id: optionalNullableString,
        original_transaction_id: optionalNullableString,
        product_id: optionalNullableString,
        store: optionalNullableString,
        transaction_id: optionalNullableString,
        type: z.string().trim().min(1),
      })
      .passthrough(),
  })
  .passthrough();

export type RevenueCatWebhook = z.infer<typeof revenueCatWebhookSchema>;
export type RevenueCatWebhookEvent = RevenueCatWebhook['event'];

export interface BillingEntitlementSummary {
  active: boolean;
  expiresAt: string | null;
  key: string;
}

export interface BillingSummary {
  customerId: string;
  entitlements: BillingEntitlementSummary[];
}
