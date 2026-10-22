// Store catalog configuration. Checkout must always display the localized price
// returned by the store SDK, rather than converting this USD base price itself.
export const creatorProMonthlyPlan = {
  amountMinor: 1200,
  currency: 'USD',
  entitlementId: 'creator_pro',
  productId: 'swavii_creator_pro_monthly',
  subscriptionPeriod: 'P1M',
} as const;
import { z } from 'zod';

export const billingSummarySchema = z.object({
  customerId: z.uuid(),
  entitlements: z.array(
    z.object({
      active: z.boolean(),
      expiresAt: z.iso.datetime({ offset: true }).nullable(),
      key: z.string().min(1),
    }),
  ),
});

export type BillingSummary = z.infer<typeof billingSummarySchema>;

export function hasCreatorProAccess(summary: BillingSummary, now = Date.now()): boolean {
  return summary.entitlements.some(
    (entry) =>
      entry.key === creatorProMonthlyPlan.entitlementId &&
      entry.active &&
      (entry.expiresAt === null || Date.parse(entry.expiresAt) > now),
  );
}
