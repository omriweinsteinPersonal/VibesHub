# Billing and entitlements

Swavii treats payment providers as evidence of access, not as the source of product
authorization inside application code. The API owns the normalized entitlement record
used by web and mobile clients.

## Current scope

This integration is deliberately sandbox-only:

- RevenueCat Test Store has `monthly` and `yearly` products attached to the
  `creator_pro` entitlement through the default offering.
- No App Store Connect or Google Play product is created.
- No RevenueCat payment method is required or stored.
- No Polar integration or web checkout is enabled.
- `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY` is used only by development builds.
- Release builds ignore the Test Store key and refuse a `test_` key placed in either
  platform production-key slot.
- Empty mobile RevenueCat public keys leave the SDK disabled.
- The RevenueCat webhook accepts `SANDBOX` events by default and ignores production
  events until the allowed environment is changed intentionally.

## Data flow

1. An authenticated, approved creator calls `GET /v1/billing`.
2. The API creates or returns an opaque `customerId`. This UUID is not the creator's
   Supabase Auth user ID and contains no email or profile information.
3. The native client identifies the signed-in creator to RevenueCat with that opaque ID.
4. Apple StoreKit or Google Play Billing will eventually complete the native purchase.
5. RevenueCat sends a webhook to `POST /v1/webhooks/revenuecat`.
6. The API verifies the configured authorization value and the HMAC over the exact raw
   request bytes, applies a five-minute replay window, deduplicates the event ID, and
   ignores events from the disallowed environment.
7. The API updates normalized subscriptions and entitlements only when the incoming
   event is at least as new as the stored event.

Clients never receive webhook secrets, store credentials, database credentials, or a
RevenueCat secret API key. The `EXPO_PUBLIC_REVENUECAT_*_API_KEY` values are public SDK
identifiers. Only platform-specific Apple and Google keys may ship in release builds;
the Test Store key stays in a developer's ignored `.env.local` or a development build
environment.

## Database boundary

The `billing` schema contains `accounts`, `subscriptions`, and `entitlements`.
`ops.webhook_receipts` provides event deduplication without retaining full provider
payloads or customer attributes. All four tables have RLS enabled and all access is
revoked from Supabase `anon` and `authenticated` roles. Only the NestJS API's direct
database connection accesses them.

Account deletion cascades the creator's billing identity, subscriptions, and entitlement
state. Receipt rows contain provider event IDs and payload hashes only; they do not store
emails, names, raw payloads, or the internal user ID.

## Sandbox activation

1. The RevenueCat project and Test Store catalog are configured without a payment card.
2. Put the public Test Store SDK key in
   `apps/mobile/.env.local` as `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY`.
3. Configure a sandbox-only webhook to
   `https://vibeshub-api.vercel.app/v1/webhooks/revenuecat`.
4. Set a long random Authorization header and enable RevenueCat HMAC signing.
5. Store the two webhook values only in the API project's sensitive Production
   environment variables.
6. Keep `REVENUECAT_ALLOWED_ENVIRONMENT=sandbox`.
7. Use an Expo development build for purchase testing; Expo Go is not a release
   purchase environment.

Before enabling production, configure App Store Connect and Play Console agreements,
tax, payout, products, server notifications, restore-purchases UI, subscription terms,
and support procedures. Production enablement is a separate reviewed change.
