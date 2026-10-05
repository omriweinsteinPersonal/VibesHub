const appleTeamIdPattern = /^[A-Z0-9]{10}$/;
const sha256FingerprintPattern = /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/;

const appleExcludedPaths = [
  '/account-deletion',
  '/analytics/*',
  '/auth/*',
  '/creator/*',
  '/dashboard/*',
  '/privacy',
  '/support',
  '/terms',
];

export function createAppleAppSiteAssociation(teamId: string) {
  const normalizedTeamId = teamId.trim().toUpperCase();
  if (!appleTeamIdPattern.test(normalizedTeamId)) {
    throw new Error('APPLE_TEAM_ID must be the 10-character Apple Developer Team ID.');
  }

  return {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [`${normalizedTeamId}.com.swavii.app`],
          components: [
            ...appleExcludedPaths.map((path) => ({ '/': path, exclude: true })),
            { '/': '/*', comment: 'Public Swavii creator storefronts and product pages' },
          ],
        },
      ],
    },
  };
}

export function createAndroidAssetLinks(rawFingerprints: string) {
  const fingerprints = rawFingerprints
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (
    fingerprints.length === 0 ||
    fingerprints.some((value) => !sha256FingerprintPattern.test(value))
  ) {
    throw new Error(
      'ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS must contain comma-separated SHA-256 fingerprints.',
    );
  }

  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.swavii.app',
        sha256_cert_fingerprints: [...new Set(fingerprints)],
      },
    },
  ];
}
