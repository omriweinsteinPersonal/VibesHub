# ADR-008: Native billing and provider-neutral entitlements

**Status:** Accepted

**Date:** 2026-09-30

## Context

Swavii plans to sell digital creator-platform functionality through iOS and Android.
Apple Pay and Google Pay are payment methods, not replacements for the stores' required
in-app purchase systems for digital subscriptions. Building and maintaining two receipt
validation implementations would add avoidable security and lifecycle complexity.

The product is not ready to charge users, the owner does not want to add a card or incur
provider charges, and Israeli business/tax details are not ready to configure. The data
model must nevertheless avoid locking authorization to one billing vendor.

## Decision

- Use Apple StoreKit and Google Play Billing for native digital subscriptions.
- Use RevenueCat as the initial receipt and subscription-lifecycle adapter.
- Keep Swavii's entitlement model in private PostgreSQL tables behind the NestJS API.
- Identify creators to RevenueCat with a generated opaque UUID rather than a Supabase
  Auth ID or email.
- Require both an authorization header and RevenueCat HMAC signature on webhooks.
- Deduplicate webhook event IDs and reject stale signatures and conflicting payloads.
- Default all integration settings to sandbox and keep the SDK disabled when its public
  platform key is absent.
- Reserve `creator_pro` as the first entitlement identifier, without creating live store
  products in this slice.
- Defer Polar and web checkout until a concrete web-billing need and tax/merchant model
  are approved.
- Preserve ADR-006: billing remains part of the separate shared NestJS API; it does not
  move into Next.js Route Handlers and does not require deploying the worker.

## Consequences

- Mobile purchase UX and store compliance can share one application entitlement model.
- RevenueCat can be replaced because clients consume Swavii API entitlements and the
  database stores normalized provider/store fields.
- Webhook delivery is eventually consistent, so the native SDK may reflect a purchase
  before the API mirror receives its event.
- Production launch still requires store agreements, tax and payout setup, product
  metadata, restore-purchase UI, testing, and review.
- Public RevenueCat SDK keys may ship in the app; webhook and server API secrets must not.

## Rejected alternatives

### Apple Pay or Google Pay for native digital subscriptions

Rejected because wallet payments do not replace StoreKit or Google Play Billing for
digital functionality sold in the native apps.

### Polar as the first billing integration

Deferred because the immediate requirement is native store subscriptions. Adding a web
merchant-of-record flow now would add tax, account, and entitlement-reconciliation work
before there is a web checkout requirement.

### Trust entitlement state only on the client

Rejected because server-side feature enforcement and web/mobile consistency require an
authoritative API-readable entitlement record.

### Store raw webhook payloads indefinitely

Rejected to reduce sensitive-data retention. Swavii stores the event ID, payload hash,
processing status, and normalized subscription state instead.

## Revisit when

- Swavii is ready to create production store products,
- a web subscription checkout is required,
- RevenueCat pricing or capabilities no longer fit measured usage,
- Israeli invoicing or tax requirements require another system, or
- entitlements become complex enough to require a dedicated billing service.
