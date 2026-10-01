import { describe, expect, it } from 'vitest';

import { resolveRevenueCatApiKey } from './billing-config';

describe('resolveRevenueCatApiKey', () => {
  it.each(['ios', 'android'] as const)(
    'uses the Test Store key for %s development builds',
    (platform) => {
      expect(
        resolveRevenueCatApiKey({
          androidApiKey: 'goog_live',
          iosApiKey: 'appl_live',
          isDevelopment: true,
          platform,
          testStoreApiKey: '  test_sandbox  ',
        }),
      ).toBe('test_sandbox');
    },
  );

  it('ignores the Test Store key in an iOS release build', () => {
    expect(
      resolveRevenueCatApiKey({
        iosApiKey: 'appl_live',
        isDevelopment: false,
        platform: 'ios',
        testStoreApiKey: 'test_sandbox',
      }),
    ).toBe('appl_live');
  });

  it('ignores the Test Store key in an Android release build', () => {
    expect(
      resolveRevenueCatApiKey({
        androidApiKey: 'goog_live',
        isDevelopment: false,
        platform: 'android',
        testStoreApiKey: 'test_sandbox',
      }),
    ).toBe('goog_live');
  });

  it.each(['ios', 'android'] as const)(
    'disables %s billing when a Test Store key is put in the release key slot',
    (platform) => {
      expect(
        resolveRevenueCatApiKey({
          androidApiKey: 'test_wrong_slot',
          iosApiKey: 'test_wrong_slot',
          isDevelopment: false,
          platform,
        }),
      ).toBeUndefined();
    },
  );

  it('does not configure the native SDK on web', () => {
    expect(
      resolveRevenueCatApiKey({
        isDevelopment: true,
        platform: 'web',
        testStoreApiKey: 'test_sandbox',
      }),
    ).toBeUndefined();
  });
});
