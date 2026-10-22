import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getNativePlans,
  configureNativeBilling,
  purchaseNativePlan,
  resetNativeBilling,
  restoreNativePurchases,
  manageNativeSubscription,
  selectNativePlan,
} from './billing';
import type { PurchasesPackage } from 'react-native-purchases';

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
  showManageSubscriptions: vi.fn(),
  openURL: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: mocks.platform,
  Linking: { openURL: mocks.openURL },
}));
vi.mock('./api', () => ({ getBillingSummary: mocks.summary }));
vi.mock('react-native-purchases', () => ({ default: mocks }));

const plan = {
  identifier: 'monthly',
  product: {
    identifier: 'swavii_creator_pro_monthly',
    price: 12,
    currencyCode: 'USD',
    subscriptionPeriod: 'P1M',
  },
} as PurchasesPackage;
const selection = selectNativePlan(plan);
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
    expect(await purchaseNativePlan(selection)).toBe('active');
    expect(mocks.logIn).toHaveBeenCalledWith('opaque-customer');
    expect(mocks.purchasePackage).toHaveBeenCalledWith(plan);
  });
  it('does not open checkout in a release build', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_live');
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'goog_live');
    await expect(purchaseNativePlan(selection)).rejects.toThrow('not available');
    expect(mocks.purchasePackage).not.toHaveBeenCalled();
  });
  it('rejects a stale package and treats cancellation as a normal result', async () => {
    await expect(
      purchaseNativePlan({ ...selection, packageIdentifier: 'removed' }),
    ).rejects.toThrow('no longer available');
    expect(mocks.purchasePackage).not.toHaveBeenCalled();
    mocks.purchasePackage.mockRejectedValue({ userCancelled: true });
    expect(await purchaseNativePlan(selection)).toBe('cancelled');
  });
  it('only offers the approved monthly period', async () => {
    mocks.getOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          plan,
          {
            identifier: 'yearly',
            product: { ...plan.product, subscriptionPeriod: 'P1Y' },
          },
          {
            identifier: 'other-monthly',
            product: { ...plan.product, identifier: 'unrelated' },
          },
        ],
      },
    });
    expect(await getNativePlans()).toEqual([plan]);
    await expect(
      purchaseNativePlan({ ...selection, packageIdentifier: 'yearly' }),
    ).rejects.toThrow('no longer available');
    await expect(
      purchaseNativePlan({ ...selection, packageIdentifier: 'other-monthly' }),
    ).rejects.toThrow('no longer available');
    expect(mocks.purchasePackage).not.toHaveBeenCalled();
  });
  it('does not report unrelated entitlements as Swavii Pro', async () => {
    mocks.restorePurchases.mockResolvedValue({
      entitlements: { active: { unrelated: {} } },
    });
    expect(await restoreNativePurchases()).toBe(false);
  });
  it('refuses purchases when the authenticated billing account cannot be loaded', async () => {
    mocks.summary.mockRejectedValue(new Error('Please log in'));
    await expect(purchaseNativePlan(selection)).rejects.toThrow('Please log in');
    expect(mocks.purchasePackage).not.toHaveBeenCalled();
  });
  it.each([{ price: 15 }, { currencyCode: 'EUR' }])(
    'requires another review when the offer changes: %o',
    async (change) => {
      mocks.getOfferings.mockResolvedValue({
        current: {
          availablePackages: [{ ...plan, product: { ...plan.product, ...change } }],
        },
      });
      await expect(purchaseNativePlan(selection)).rejects.toThrow('plan has changed');
      expect(mocks.purchasePackage).not.toHaveBeenCalled();
    },
  );
  it('rejects a checkout whose account signs out during loading', async () => {
    let resolveSummary!: (value: { customerId: string }) => void;
    let started!: () => void;
    const loading = new Promise<void>((resolve) => {
      started = resolve;
    });
    mocks.summary.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        resolveSummary = resolve;
      });
    });
    const purchase = purchaseNativePlan(selection);
    const rejected = expect(purchase).rejects.toThrow('account changed');
    await loading;
    const reset = resetNativeBilling();
    resolveSummary({ customerId: 'old-customer' });
    await rejected;
    await reset;
    expect(mocks.purchasePackage).not.toHaveBeenCalled();
  });
  it('keeps the store identity stable until an open purchase completes', async () => {
    let complete!: (value: unknown) => void;
    let started!: () => void;
    const purchasing = new Promise<void>((resolve) => {
      started = resolve;
    });
    mocks.purchasePackage.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        complete = resolve;
      });
    });
    const purchase = purchaseNativePlan(selection);
    await purchasing;
    const nextAccount = configureNativeBilling('next-customer');
    expect(mocks.logIn).not.toHaveBeenCalledWith('next-customer');
    complete({ customerInfo: { entitlements: { active: { creator_pro: {} } } } });
    await purchase;
    await nextAccount;
    expect(mocks.logIn).toHaveBeenLastCalledWith('next-customer');
  });
  it('opens subscription management using the correct platform', async () => {
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY', '');
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_store');
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'goog_store');
    await manageNativeSubscription();
    if (platform === 'android') {
      expect(mocks.openURL).toHaveBeenCalledWith(
        'https://play.google.com/store/account/subscriptions',
      );
      expect(mocks.showManageSubscriptions).not.toHaveBeenCalled();
    } else {
      expect(mocks.showManageSubscriptions).toHaveBeenCalledOnce();
      expect(mocks.openURL).not.toHaveBeenCalled();
    }
  });
  it('does not open a real store to manage a Test Store subscription', async () => {
    await expect(manageNativeSubscription()).rejects.toThrow('Test Store');
    expect(mocks.openURL).not.toHaveBeenCalled();
    expect(mocks.showManageSubscriptions).not.toHaveBeenCalled();
  });
});
