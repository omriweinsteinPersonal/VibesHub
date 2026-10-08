const profile = process.env.EAS_BUILD_PROFILE?.trim();

if (!profile) {
  console.log('Skipping EAS environment validation outside an EAS build.');
  process.exit(0);
}

const errors = [];
const requiredPublicValues = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];

for (const name of requiredPublicValues) {
  if (!process.env[name]?.trim())
    errors.push(`${name} is required for ${profile} builds.`);
}

for (const name of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_URL']) {
  const value = process.env[name]?.trim();
  if (!value) continue;

  try {
    const url = new URL(value);
    if (profile === 'production' && url.protocol !== 'https:') {
      errors.push(`${name} must use HTTPS for production builds.`);
    }
  } catch {
    errors.push(`${name} must be a valid absolute URL.`);
  }
}

const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
if (/service[_-]?role|secret/i.test(publishableKey)) {
  errors.push(
    'The mobile Supabase key must be publishable, never service-role or secret.',
  );
}

if (profile === 'production') {
  for (const name of [
    'EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY',
    'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
    'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
  ]) {
    if (process.env[name]?.trim()) {
      errors.push(`${name} must remain unset for the free first production release.`);
    }
  }
}

if (errors.length > 0) {
  console.error('Mobile build environment validation failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Mobile ${profile} build environment is valid.`);
