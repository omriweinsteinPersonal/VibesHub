import { readFile } from 'node:fs/promises';

const appConfig = JSON.parse(await readFile('apps/mobile/app.json', 'utf8')).expo;
const loginSource = await readFile('apps/mobile/app/login.tsx', 'utf8');
const accountSource = await readFile('apps/mobile/app/account.tsx', 'utf8');
const errors = [];

function requireValue(condition, message) {
  if (!condition) errors.push(message);
}

requireValue(appConfig.name === 'Swavii', 'The native app name must be Swavii.');
requireValue(appConfig.slug === 'swavii', 'The Expo slug must be swavii.');
requireValue(appConfig.scheme === 'swavii', 'The auth/deep-link scheme must be swavii.');
requireValue(/^\d+\.\d+\.\d+$/.test(appConfig.version), 'App version must use x.y.z.');
requireValue(
  appConfig.ios?.bundleIdentifier === 'com.swavii.app',
  'The iOS bundle identifier must be com.swavii.app.',
);
requireValue(
  appConfig.android?.package === 'com.swavii.app',
  'The Android application ID must be com.swavii.app.',
);
requireValue(
  appConfig.ios?.usesAppleSignIn === true,
  'Sign in with Apple must be enabled.',
);
requireValue(
  appConfig.ios?.config?.usesNonExemptEncryption === false,
  'The export-compliance encryption declaration is missing.',
);
requireValue(
  appConfig.ios?.privacyManifests?.NSPrivacyTracking === false,
  'The iOS privacy manifest tracking declaration is missing.',
);

const plugins = appConfig.plugins.map((plugin) =>
  Array.isArray(plugin) ? plugin[0] : plugin,
);
for (const plugin of [
  'expo-apple-authentication',
  'expo-router',
  'expo-secure-store',
  'expo-splash-screen',
  'expo-web-browser',
]) {
  requireValue(plugins.includes(plugin), `Required Expo plugin is missing: ${plugin}.`);
}

for (const domain of ['applinks:swavii.com']) {
  requireValue(
    appConfig.ios?.associatedDomains?.includes(domain),
    `Required iOS associated domain is missing: ${domain}.`,
  );
}

const verifiedHosts = new Set(
  (appConfig.android?.intentFilters ?? [])
    .filter((filter) => filter.autoVerify === true)
    .flatMap((filter) => filter.data ?? [])
    .filter((entry) => entry.scheme === 'https')
    .map((entry) => entry.host),
);
for (const host of ['swavii.com']) {
  requireValue(
    verifiedHosts.has(host),
    `Required verified Android host is missing: ${host}.`,
  );
}

for (const path of ['/privacy', '/terms']) {
  requireValue(
    loginSource.includes(`https://swavii.com${path}`),
    `${path} must be linked before login.`,
  );
}
for (const path of ['/privacy', '/terms', '/support', '/creator-home']) {
  requireValue(
    accountSource.includes(`https://swavii.com${path}`),
    `${path} must be linked from Account.`,
  );
}
requireValue(
  accountSource.includes('Delete account'),
  'Account deletion must remain discoverable in the native app.',
);

if (errors.length > 0) {
  console.error('Mobile release validation failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Mobile release configuration is valid.');
}
