import { Platform } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { getBillingSummary } from './api';
import { resolveRevenueCatApiKey } from './billing-config';

let configuredCustomerId: string | undefined;
export const creatorProEntitlement = 'creator_pro';

// Keep checkout opt-in while product benefits and store agreements are finalized.
export function isNativeCheckoutEnabled(): boolean {
  return __DEV__ && Boolean(getRevenueCatApiKey()?.startsWith('test_'));
}

async function connectedPurchases() {
  if (!getRevenueCatApiKey())
    throw new Error('Purchases are not available in this build.');
  const summary = await getBillingSummary();
  await configureNativeBilling(summary.customerId);
  return (await import('react-native-purchases')).default;
}

export async function getNativePlans(): Promise<PurchasesPackage[]> {
  if (!isNativeCheckoutEnabled()) return [];
  const Purchases = await connectedPurchases();
  const offerings = await Purchases.getOfferings();
  return (
    offerings.current?.availablePackages.filter((plan) =>
      Boolean(plan.product.subscriptionPeriod),
    ) ?? []
  );
}

export async function purchaseNativePlan(
  identifier: string,
): Promise<'cancelled' | 'pending' | 'active'> {
  if (!isNativeCheckoutEnabled()) throw new Error('Subscriptions are not available yet.');
  const Purchases = await connectedPurchases();
  const offerings = await Purchases.getOfferings();
  const plan = offerings.current?.availablePackages.find(
    (item) => item.identifier === identifier && Boolean(item.product.subscriptionPeriod),
  );
  if (!plan) throw new Error('This plan is no longer available. Refresh and try again.');
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
  const Purchases = await connectedPurchases();
  await Purchases.showManageSubscriptions();
}

export function isNativeBillingConfigured(): boolean {
  return Boolean(getRevenueCatApiKey());
}

export async function configureNativeBilling(customerId: string): Promise<void> {
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
  if (!configuredCustomerId) return;
  const Purchases = (await import('react-native-purchases')).default;
  if (!(await Purchases.isConfigured())) return;
  await Purchases.logOut();
  configuredCustomerId = undefined;
}

export async function restoreNativePurchases(): Promise<boolean> {
  const Purchases = await connectedPurchases();
  const customerInfo = await Purchases.restorePurchases();
  return Boolean(customerInfo.entitlements.active[creatorProEntitlement]);
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
