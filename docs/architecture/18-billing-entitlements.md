# Billing and entitlements

Swavii treats payment providers as evidence of access, not as the source of product
authorization inside application code. The API owns the normalized entitlement record
used by web and mobile clients.

## Current scope

This slice is deliberately sandbox-only:

- The only planned entitlement identifier is `creator_pro`.
- No App Store Connect or Google Play product is created.
- No RevenueCat payment method is required or stored.
- No Polar integration or web checkout is enabled.
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
RevenueCat secret API key. The `EXPO_PUBLIC_REVENUECAT_*_API_KEY` values are the public
SDK keys intended to ship in the native application.

## Database boundary

The `billing` schema contains `accounts`, `subscriptions`, and `entitlements`.
`ops.webhook_receipts` provides event deduplication without retaining full provider
payloads or customer attributes. All four tables have RLS enabled and all access is
revoked from Supabase `anon` and `authenticated` roles. Only the NestJS API's direct
database connection accesses them.

Account deletion cascades the creator's billing identity, subscriptions, and entitlement
state. Receipt rows contain provider event IDs and payload hashes only; they do not store
emails, names, raw payloads, or the internal user ID.

## Enabling sandbox testing later

1. Create a RevenueCat project without adding a payment card.
2. Create iOS and Android apps and use RevenueCat Test Store or platform sandbox
   products only.
3. Create the `creator_pro` entitlement and attach sandbox products.
4. Configure a webhook to `https://<api-domain>/v1/webhooks/revenuecat`.
5. Set a long random Authorization header and enable RevenueCat HMAC signing.
6. Store the two webhook values only in the API project's secret environment variables.
7. Keep `REVENUECAT_ALLOWED_ENVIRONMENT=sandbox`.
8. Add the public iOS and Android SDK keys to the native build environment.
9. Use an Expo development build for real purchase testing; Expo Go is not a release
   purchase environment.

Before enabling production, configure App Store Connect and Play Console agreements,
tax, payout, products, server notifications, restore-purchases UI, subscription terms,
and support procedures. Production enablement is a separate reviewed change.
