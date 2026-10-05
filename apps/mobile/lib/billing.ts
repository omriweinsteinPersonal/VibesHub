import { Platform } from 'react-native';

import { resolveRevenueCatApiKey } from './billing-config';

let configuredCustomerId: string | undefined;

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
  if (!getRevenueCatApiKey()) {
    throw new Error('Purchases are not available in this build.');
  }
  const Purchases = (await import('react-native-purchases')).default;
  if (!(await Purchases.isConfigured())) {
    throw new Error('Purchases are still connecting. Please try again.');
  }
  const customerInfo = await Purchases.restorePurchases();
  return Object.keys(customerInfo.entitlements.active).length > 0;
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
