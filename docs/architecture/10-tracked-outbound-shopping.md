# Tracked outbound shopping slice

**Status:** Implemented phase 1

**Date:** 2026-08-07

## Scope

Every dynamic recommendation now exposes a VibesHub-owned `shopUrl` backed by the shared NestJS API:

```text
GET /go/{non-sequential-public-id}
```

The endpoint remains outside `/v1`, does not require authentication, and never accepts a destination URL from the shopper. It resolves only the destination already stored against the public ID, validates it again, records a server-authoritative click event on a best-effort basis, and returns `302` with no-store and no-referrer response headers.

The worker is not deployed or required for this synchronous path. Click events accumulate in `ops.outbox_events` until the approved worker deployment is introduced.

## Data and trust model

- `app.merchant_domains` is the exact-hostname importer and redirect allowlist.
- `app.affiliate_links` separates the public redirect identity from a private destination URL.
- Both tables live in the private `app` schema, have RLS enabled, and grant no access to Supabase client roles.
- Creator-supplied destinations must use public HTTPS hostnames without credentials, IP literals, local/internal names, or custom ports.
- A newly encountered hostname is stored with `allow_redirect = false`; creator input never approves its own destination.
- Publishing activates the link only when an administrator has approved the exact hostname. Otherwise the recommendation remains a draft and the API returns `MERCHANT_DOMAIN_NOT_APPROVED`.
- Disabling an approved hostname immediately moves all of its active or unhealthy links to `blocked` in the same database transaction.
- The database trigger independently enforces hostname equality and refuses active links for unapproved domains.

## Administration

An authenticated administrator manages a merchant hostname through:

```text
POST /v1/admin/merchants/{merchantId}/domains
Idempotency-Key: <unique command key>

{
  "hostname": "shop.example.com",
  "allowImport": false,
  "allowRedirect": true
}
```

The endpoint requires `admin:manage_platform`, normalizes the hostname, prevents a hostname from belonging to two merchants, and writes an immutable audit entry. The first admin UI for this endpoint remains a later operations slice.

## Client contract

Public recommendation cards receive only the tracked `shopUrl` plus a display-only `merchantHostname`; they never receive the merchant destination. Creator management responses additionally receive `productUrl` so the editor can retain the real offer URL without deriving it from `shopUrl`.

Web cards open the tracked URL in a new tab with `nofollow sponsored noopener noreferrer`. The same absolute URL is suitable for future native iOS and Android clients because redirect authority stays in the shared API.

## Failure behavior

Malformed, missing, blocked, unhealthy, unapproved, suspended, unpublished, or mismatched links return a small safe VibesHub HTML page with `404`. The API does not follow merchant redirect chains during a shopper click and never forwards shopper query parameters. Failure to enqueue analytics is logged without blocking an otherwise valid shopping redirect.

## Deployment boundary

`REDIRECT_BASE_URL` is server-only and defaults to `http://localhost:4000` in development. Production requires an HTTPS origin. Until the user deploys the NestJS API, the production web app continues its existing unavailable-state behavior and no Cloud Run or worker resources are created.
