import { describe, expect, it } from 'vitest';

import { createAndroidAssetLinks, createAppleAppSiteAssociation } from './app-links';

describe('app link association payloads', () => {
  it('creates an Apple association for the production bundle', () => {
    const association = createAppleAppSiteAssociation('A1B2C3D4E5');

    expect(association.applinks.details[0]?.appIDs).toEqual([
      'A1B2C3D4E5.com.swavii.app',
    ]);
    expect(association.applinks.details[0]?.components).toContainEqual({
      '/': '/privacy',
      exclude: true,
    });
  });

  it('rejects invalid Apple team IDs', () => {
    expect(() => createAppleAppSiteAssociation('not-a-team')).toThrow(/APPLE_TEAM_ID/);
  });

  it('normalizes and deduplicates Android signing fingerprints', () => {
    const fingerprint = Array.from({ length: 32 }, () => 'ab').join(':');
    const association = createAndroidAssetLinks(`${fingerprint}, ${fingerprint}`);

    expect(association[0]?.target.package_name).toBe('com.swavii.app');
    expect(association[0]?.target.sha256_cert_fingerprints).toEqual([
      fingerprint.toUpperCase(),
    ]);
  });

  it('rejects invalid Android signing fingerprints', () => {
    expect(() => createAndroidAssetLinks('not-a-fingerprint')).toThrow(
      /ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS/,
    );
  });
});
