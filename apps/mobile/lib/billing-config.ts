export interface RevenueCatKeyConfiguration {
  androidApiKey?: string;
  iosApiKey?: string;
  isDevelopment: boolean;
  platform: string;
  testStoreApiKey?: string;
}

export function resolveRevenueCatApiKey({
  androidApiKey,
  iosApiKey,
  isDevelopment,
  platform,
  testStoreApiKey,
}: RevenueCatKeyConfiguration): string | undefined {
  if (platform !== 'android' && platform !== 'ios') return undefined;

  const testKey = normalizeKey(testStoreApiKey);
  if (isDevelopment && testKey && isTestStoreKey(testKey)) return testKey;

  const platformKey = normalizeKey(platform === 'ios' ? iosApiKey : androidApiKey);
  if (!platformKey) return undefined;

  // RevenueCat intentionally rejects Test Store keys in release builds. Keep
  // billing disabled instead of letting a development key reach a store build.
  if (!isDevelopment && isTestStoreKey(platformKey)) return undefined;

  return platformKey;
}

function isTestStoreKey(apiKey: string): boolean {
  return apiKey.startsWith('test_');
}

function normalizeKey(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}
