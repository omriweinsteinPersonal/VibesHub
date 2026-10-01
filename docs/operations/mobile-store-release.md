# Mobile store release

Swavii uses Expo Application Services (EAS) to produce iOS and Android binaries. Store
submission is intentionally separate from building: creating a build never authorizes a
public release.

## Build profiles

- `development` creates an internally distributed development client for a physical
  device.
- `development-simulator` creates an iOS Simulator development client.
- `preview` creates production-like internal builds; Android uses an installable APK.
- `production` creates store binaries and auto-increments the remote build version.

All profiles select an explicit EAS environment. Client values prefixed with
`EXPO_PUBLIC_` are compiled into the application and must never contain secrets.

## Required EAS environment values

Configure these as plaintext or sensitive client configuration, not secret server
credentials:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Development may additionally use `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY`. Production
must leave that value unset. The platform-specific RevenueCat iOS and Android public SDK
keys stay unset until live store products and purchase UX have been approved.

Never add database credentials, Supabase service-role keys, RevenueCat webhook secrets,
Apple private keys, or Google service-account credentials to an `EXPO_PUBLIC_` variable.

## Safe rollout sequence

1. Run tests, type checking, linting, Expo Doctor, and a local Expo export.
2. Create `development-simulator` and Android `development` builds.
3. Test authentication, session restoration, account deletion, public browsing, deep
   links, and offline/error behavior.
4. Create `preview` builds and distribute them only to internal testers.
5. Complete privacy, support, moderation, store metadata, screenshots, and reviewer
   access.
6. Create `production` builds and upload them to TestFlight and Google Play testing.
7. Submit publicly only after the release checklist is signed off.

The first release keeps RevenueCat sandbox-only and does not expose a subscription or
paywall.
