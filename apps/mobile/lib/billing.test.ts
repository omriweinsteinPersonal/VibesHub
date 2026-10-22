import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getNativePlans,
  purchaseNativePlan,
  resetNativeBilling,
  restoreNativePurchases,
} from './billing';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  summary: vi.fn(),
  configure: vi.fn(),
  logIn: vi.fn(),
  logOut: vi.fn(),
  isConfigured: vi.fn(),
  getOfferings: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: mocks.platform }));
vi.mock('./api', () => ({ getBillingSummary: mocks.summary }));
vi.mock('react-native-purchases', () => ({ default: mocks }));

const plan = { identifier: 'monthly', product: { subscriptionPeriod: 'P1M' } };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('__DEV__', true);
  vi.stubEnv('EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY', 'test_sandbox');
  mocks.summary.mockResolvedValue({ customerId: 'opaque-customer' });
  mocks.isConfigured.mockResolvedValue(true);
  mocks.getOfferings.mockResolvedValue({ current: { availablePackages: [plan] } });
});
afterEach(async () => {
  await resetNativeBilling();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe.each(['ios', 'android'])('native checkout on %s', (platform) => {
  beforeEach(() => {
    mocks.platform.OS = platform;
  });
  it('connects the backend customer and buys the current store package', async () => {
    mocks.purchasePackage.mockResolvedValue({
      customerInfo: { entitlements: { active: { creator_pro: {} } } },
    });
    expect(await getNativePlans()).toEqual([plan]);
    expect(await purchaseNativePlan('monthly')).toBe('active');
    expect(mocks.logIn).toHaveBeenCalledWith('opaque-customer');
    expect(mocks.purchasePackage).toHaveBeenCalledWith(plan);
  });
  it('does not open checkout in a release build', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_live');
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'goog_live');
    await expect(purchaseNativePlan('monthly')).rejects.toThrow('not available');
    expect(mocks.purchasePackage).not.toHaveBeenCalled();
  });
  it('rejects a stale package and treats cancellation as a normal result', async () => {
    await expect(purchaseNativePlan('removed')).rejects.toThrow('no longer available');
    expect(mocks.purchasePackage).not.toHaveBeenCalled();
    mocks.purchasePackage.mockRejectedValue({ userCancelled: true });
    expect(await purchaseNativePlan('monthly')).toBe('cancelled');
  });
  it('does not report unrelated entitlements as Swavii Pro', async () => {
    mocks.restorePurchases.mockResolvedValue({
      entitlements: { active: { unrelated: {} } },
    });
    expect(await restoreNativePurchases()).toBe(false);
  });
  it('refuses purchases when the authenticated billing account cannot be loaded', async () => {
    mocks.summary.mockRejectedValue(new Error('Please log in'));
    await expect(purchaseNativePlan('monthly')).rejects.toThrow('Please log in');
    expect(mocks.purchasePackage).not.toHaveBeenCalled();
  });
});
