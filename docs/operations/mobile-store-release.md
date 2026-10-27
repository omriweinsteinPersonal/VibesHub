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

The API needs the following server-only values before testing deletion for an account
that uses Sign in with Apple:

- `APPLE_CLIENT_ID=com.swavii.app`
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY` (the `.p8` contents, stored as a sensitive value)

These four values must be configured together. They let the API exchange a fresh,
single-use Apple authorization code and revoke the Apple token before deleting the
Swavii identity. The private key must exist only in the API environment, never in EAS or
the mobile bundle.

## Safe rollout sequence

### Local creator smoke checks (no EAS quota)

Use the latest local JavaScript with an installed development client, or a current
locally built app. Sign in to a dedicated creator test account on each device first.
The flows below do not create, save, publish or delete content, purchase anything, or
sign out. Do not run them against an account with unsaved edits: switching tabs closes
the current editor.

With Maestro installed and the simulator/emulator booted, run each flow separately on
both platforms, using the device ID from `maestro list-devices`:

```bash
maestro --platform ios --udid <simulator-id> test --test-output-dir /tmp/swavii-ios-actions .maestro/creator-dashboard-actions.yaml
maestro --platform android --udid <emulator-id> test --test-output-dir /tmp/swavii-android-actions .maestro/creator-dashboard-actions.yaml
maestro --platform ios --udid <simulator-id> test --test-output-dir /tmp/swavii-ios-navigation .maestro/creator-navigation.yaml
maestro --platform android --udid <emulator-id> test --test-output-dir /tmp/swavii-android-navigation .maestro/creator-navigation.yaml
```

The action flow checks all five editor buttons, their selected accessibility state,
and reset after leaving the dashboard. The navigation flow checks all creator tabs
and signed-in session restoration after stopping and relaunching the app. Inspect the
screenshots as well as the assertions: check selected button contrast, readable status
bar icons, safe areas, and the absence of browser chrome. These native tests do not
replace mobile-web checks or device coverage of saves, uploads, OAuth and purchases.
Keep credentials, screenshots and test output outside Git. Never add test-only auth
bypasses or server secrets to the app to make a smoke flow pass.

### Release sequence

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

## Native authentication redirect

Google OAuth intentionally uses the operating system's secure authentication sheet, but
that sheet must close as soon as authentication succeeds. The Supabase production Auth
URL configuration must include `swavii://**` under Additional Redirect URLs. If this is
missing, Supabase falls back to the website Site URL and leaves the creator browsing the
web product inside the authentication sheet instead of returning to the native app.

Keep `swavii://**` in `supabase/config.toml`, apply the matching setting to production
with `supabase config push`, and verify a real OAuth authorization response retains
`swavii://auth/callback` before creating a store build. The mobile client also rejects an
authorization URL whose `redirect_to` does not exactly match its native callback.

## Universal Links and Android App Links

The native app claims `https://swavii.com/*`. Public creator URLs therefore open the
installed app and continue to work in a browser when the app is not installed. Unknown
native routes show a safe button that returns the visitor to the same path on the
website. Do not add `www.swavii.com` until that host has working DNS and serves its own
association files without a redirect.

Before testing these links, configure two server-side Vercel values for the web project:

- `APPLE_TEAM_ID`: the 10-character Team ID shown in Apple Developer membership details.
- `ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS`: comma-separated SHA-256 fingerprints for
  every currently accepted Android signing certificate. Include the Play App Signing
  fingerprint before production testing in Google Play.

These values are public application identifiers, not secrets. They power:

- `https://swavii.com/.well-known/apple-app-site-association`
- `https://swavii.com/.well-known/assetlinks.json`

After deploying, both endpoints must return HTTP 200 with JSON and no redirect. Test a
real `https://swavii.com/{creator-handle}` link from Messages or Notes on physical iOS and
Android devices. Do not mark deep links complete based only on simulator navigation.

## Store readiness checklist

- [ ] `/privacy`, `/terms`, `/support`, and `/account-deletion` return HTTP 200 publicly.
- [ ] The support mailbox receives and can reply to an external test email.
- [ ] iOS Universal Links open a published creator storefront on a physical device.
- [ ] Android App Links are verified for the Play signing certificate.
- [ ] Sign-in, session restoration, sign-out, and account deletion pass on both platforms.
- [ ] Deleting a Sign in with Apple account asks for fresh Apple authorization and the
      same Apple account can subsequently sign up again cleanly.
- [ ] Storefront images, search, social links, discount links, and product links pass on
      both platforms and at large accessibility text sizes.
- [ ] Offline, timeout, empty, unavailable, and not-found states are understandable.
- [ ] App icon, screenshots, store description, privacy answers, content rating, and
      reviewer notes are complete.
- [ ] iOS TestFlight internal testing and Google Play internal testing pass before public
      submission.
- [ ] RevenueCat production keys and paywalls remain absent until paid subscriptions are
      intentionally enabled and store products are approved.

Use `store-submission-metadata.md` for approved listing copy, privacy/data-safety working
answers, reviewer notes, and console-only assets. Never commit reviewer credentials or
store service-account keys.
