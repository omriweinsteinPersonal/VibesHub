# Tracked outbound shopping slice

**Status:** Implemented phase 2

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

An authenticated administrator discovers merchant hostnames through the paginated
review queue:

```text
GET /v1/admin/merchant-domains?status=pending&limit=20
```

Decisions use explicit commands with both an idempotency key and the row version:

```text
POST /v1/admin/merchant-domains/{domainId}/approve
POST /v1/admin/merchant-domains/{domainId}/reject
POST /v1/admin/merchant-domains/{domainId}/disable

If-Match: 3
Idempotency-Key: <unique command key>

// approval
{
  "allowImport": false,
  "allowRedirect": true,
  "note": "Verified against the merchant homepage"
}
```

All endpoints require `admin:manage_platform`. Rejection and disabling require an
internal reason. Stale decisions fail with `412`, invalid lifecycle changes fail
with `409`, and every successful decision writes an immutable audit entry. The
administrator interface lives at `/admin/merchant-domains` and shows the merchant,
affected recommendation and creator counts, prior notes, and all four review states.

## Client contract

Public recommendation cards receive only the tracked `shopUrl` plus a display-only `merchantHostname`; they never receive the merchant destination. Creator management responses additionally receive `productUrl` so the editor can retain the real offer URL without deriving it from `shopUrl`.

Web cards open the tracked URL in a new tab with `nofollow sponsored noopener noreferrer`. The same absolute URL is suitable for future native iOS and Android clients because redirect authority stays in the shared API.

## Failure behavior

Malformed, missing, blocked, unhealthy, unapproved, suspended, unpublished, or mismatched links return a small safe VibesHub HTML page with `404`. The API does not follow merchant redirect chains during a shopper click and never forwards shopper query parameters. Failure to enqueue analytics is logged without blocking an otherwise valid shopping redirect.

## Deployment boundary

`REDIRECT_BASE_URL` is server-only and defaults to `http://localhost:4000` in development. Production requires the standalone NestJS API's stable HTTPS origin. The API deploys independently from the web application in Vercel `fra1`; no Next.js Route Handler, worker, or Google Cloud resource owns this route.
