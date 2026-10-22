// Store catalog configuration. Checkout must always display the localized price
// returned by the store SDK, rather than converting this USD base price itself.
export const creatorProMonthlyPlan = {
  amountMinor: 1200,
  currency: 'USD',
  entitlementId: 'creator_pro',
  productId: 'swavii_creator_pro_monthly',
  subscriptionPeriod: 'P1M',
} as const;
