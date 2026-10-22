import { Platform } from 'react-native';
import { creatorProMonthlyPlan } from '@vibeshub/contracts';
import type { PurchasesPackage } from 'react-native-purchases';

import { getBillingSummary } from './api';
import { resolveRevenueCatApiKey } from './billing-config';

let configuredCustomerId: string | undefined;
let identityRevision = 0;
let operations: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = operations.then(operation);
  operations = result.catch(() => undefined);
  return result;
}

function requireCurrentIdentity(revision: number): void {
  if (revision !== identityRevision) {
    throw new Error('Your account changed. Open subscription details again to continue.');
  }
}
export const creatorProEntitlement = creatorProMonthlyPlan.entitlementId;

export interface NativePlanSelection {
  packageIdentifier: string;
  productIdentifier: string;
  price: number;
  currencyCode: string;
  subscriptionPeriod: string | null;
}

export function selectNativePlan(plan: PurchasesPackage): NativePlanSelection {
  return {
    packageIdentifier: plan.identifier,
    productIdentifier: plan.product.identifier,
    price: plan.product.price,
    currencyCode: plan.product.currencyCode,
    subscriptionPeriod: plan.product.subscriptionPeriod,
  };
}

function isApprovedPlan(plan: PurchasesPackage): boolean {
  return (
    plan.product.identifier === creatorProMonthlyPlan.productId &&
    plan.product.subscriptionPeriod === creatorProMonthlyPlan.subscriptionPeriod
  );
}

// Keep checkout opt-in while product benefits and store agreements are finalized.
export function isNativeCheckoutEnabled(): boolean {
  return __DEV__ && Boolean(getRevenueCatApiKey()?.startsWith('test_'));
}

async function connectedPurchases() {
  const revision = identityRevision;
  if (!getRevenueCatApiKey())
    throw new Error('Purchases are not available in this build.');
  const summary = await getBillingSummary();
  requireCurrentIdentity(revision);
  await configureCustomer(summary.customerId);
  requireCurrentIdentity(revision);
  return (await import('react-native-purchases')).default;
}

export async function getNativePlans(): Promise<PurchasesPackage[]> {
  if (!isNativeCheckoutEnabled()) return [];
  return serialize(async () => {
    const revision = identityRevision;
    const Purchases = await connectedPurchases();
    const offerings = await Purchases.getOfferings();
    requireCurrentIdentity(revision);
    return offerings.current?.availablePackages.filter(isApprovedPlan) ?? [];
  });
}

export async function purchaseNativePlan(
  selection: NativePlanSelection,
): Promise<'cancelled' | 'pending' | 'active'> {
  if (!isNativeCheckoutEnabled()) throw new Error('Subscriptions are not available yet.');
  return serialize(() => purchaseSelectedPlan(selection));
}

async function purchaseSelectedPlan(
  selection: NativePlanSelection,
): Promise<'cancelled' | 'pending' | 'active'> {
  const revision = identityRevision;
  const Purchases = await connectedPurchases();
  const offerings = await Purchases.getOfferings();
  requireCurrentIdentity(revision);
  const plan = offerings.current?.availablePackages.find(
    (item) => item.identifier === selection.packageIdentifier && isApprovedPlan(item),
  );
  if (!plan) throw new Error('This plan is no longer available. Refresh and try again.');
  const current = selectNativePlan(plan);
  if (
    current.productIdentifier !== selection.productIdentifier ||
    current.price !== selection.price ||
    current.currencyCode !== selection.currencyCode ||
    current.subscriptionPeriod !== selection.subscriptionPeriod
  ) {
    throw new Error(
      'This plan has changed. Refresh and review its price before subscribing.',
    );
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan);
    return customerInfo.entitlements.active[creatorProEntitlement] ? 'active' : 'pending';
  } catch (cause) {
    if (
      cause &&
      typeof cause === 'object' &&
      'userCancelled' in cause &&
      cause.userCancelled === true
    ) {
      return 'cancelled';
    }
    throw cause;
  }
}

export async function manageNativeSubscription(): Promise<void> {
  return serialize(async () => {
    const Purchases = await connectedPurchases();
    await Purchases.showManageSubscriptions();
  });
}

export function isNativeBillingConfigured(): boolean {
  return Boolean(getRevenueCatApiKey());
}

export async function configureNativeBilling(customerId: string): Promise<void> {
  const revision = ++identityRevision;
  return serialize(async () => {
    if (revision === identityRevision) await configureCustomer(customerId);
  });
}

async function configureCustomer(customerId: string): Promise<void> {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey || configuredCustomerId === customerId) return;
  const Purchases = (await import('react-native-purchases')).default;

  if (await Purchases.isConfigured()) {
    await Purchases.logIn(customerId);
  } else {
    Purchases.configure({ apiKey, appUserID: customerId });
  }
  configuredCustomerId = customerId;
}

export async function resetNativeBilling(): Promise<void> {
  ++identityRevision;
  return serialize(async () => {
    if (!configuredCustomerId) return;
    const Purchases = (await import('react-native-purchases')).default;
    try {
      if (await Purchases.isConfigured()) await Purchases.logOut();
    } finally {
      configuredCustomerId = undefined;
    }
  });
}

export async function restoreNativePurchases(): Promise<boolean> {
  return serialize(async () => {
    const Purchases = await connectedPurchases();
    const customerInfo = await Purchases.restorePurchases();
    return Boolean(customerInfo.entitlements.active[creatorProEntitlement]);
  });
}

function getRevenueCatApiKey(): string | undefined {
  return resolveRevenueCatApiKey({
    androidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    iosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    isDevelopment: __DEV__,
    platform: Platform.OS,
    testStoreApiKey: process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY,
  });
}
