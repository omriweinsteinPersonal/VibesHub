import { Platform } from 'react-native';

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

function getRevenueCatApiKey(): string | undefined {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || undefined;
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() || undefined;
  }
  return undefined;
}
