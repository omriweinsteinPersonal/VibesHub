# VibesHub HTTP API contracts

**Status:** Accepted baseline

**Date:** 2026-08-06

## 1. Purpose

The API is the authoritative interface shared by Next.js, iOS, Android, workers, administration, and approved integrations. It prevents business rules from living only in one client and provides a stable boundary while the database and internal services evolve.

This document defines the first major API contract. The repository-scaffolding step will convert it into an OpenAPI specification and generated clients.

## 2. Protocol conventions

| Concern        | Contract                                                                    |
| -------------- | --------------------------------------------------------------------------- |
| Base URL       | `https://api.vibeshub.com/v1`                                               |
| Transport      | HTTPS only                                                                  |
| Media type     | `application/json`; errors use `application/problem+json`                   |
| Naming         | camelCase JSON fields; kebab-case resource paths                            |
| Identifiers    | UUID strings; public handles/slugs where explicitly documented              |
| Time           | RFC 3339 UTC strings                                                        |
| Date           | ISO `YYYY-MM-DD`                                                            |
| Money          | Decimal string plus ISO currency, never a JSON float                        |
| Locale         | BCP 47-compatible value, initially `en` and `he`                            |
| Authentication | Supabase access token as `Authorization: Bearer <token>`                    |
| Correlation    | Client may send `X-Request-Id`; server returns canonical `X-Request-Id`     |
| Idempotency    | `Idempotency-Key` required for retryable creates and commands               |
| Concurrency    | Resource `version`, response `ETag`, and `If-Match` for conflicting updates |
| Pagination     | Opaque cursor; no public offset pagination for growing feeds                |
| Compression    | Standard HTTP negotiation                                                   |

All clients must tolerate additive response fields. They must not infer authorization or workflow state from HTTP route visibility alone.

## 3. API versioning

- Major compatibility version is in the URL: `/v1`.
- Additive fields, endpoints, and accepted enum values do not require a new major version.
- Removing/renaming fields, changing their meaning, or changing required behavior requires a deprecation window or a new major version.
- Native app versions can remain active for months; the server maintains the documented minimum supported version.
- Responses may include `Deprecation`, `Sunset`, and `Link` headers for retiring contracts.
- Business-event and job payloads have independent schema versions.

## 4. Authentication and capability resolution

The API verifies token signature, issuer, audience, expiry, and revocation-relevant account state. It then resolves VibesHub-owned capabilities from PostgreSQL.

Capabilities:

- `shopper` — implicit for an active authenticated account
- `creatorApplicant`
- `creator`
- `moderator`
- `administrator`

Creator verification and trust tier are attributes, not authentication roles. Ownership checks are always server-side.

## 5. Response envelopes

### Single resource

```json
{
  "data": {
    "id": "01989f72-07e4-7f32-9b42-1ba55d4ca001",
    "type": "creator"
  },
  "meta": {
    "requestId": "01989f72-17a0-772b-a333-c3b95d0e5001"
  }
}
```

### Collection

```json
{
  "data": [],
  "page": {
    "nextCursor": "eyJwdWJsaXNoZWRBdCI6Ii4uLiIsImlkIjoiLi4uIn0",
    "hasMore": false
  },
  "meta": {
    "requestId": "01989f72-17a0-772b-a333-c3b95d0e5001"
  }
}
```

Cursor contents are an implementation detail and may be signed or encrypted. Clients only return the cursor unchanged.

### Asynchronous operation

```json
{
  "data": {
    "operationId": "01989f72-3d78-78ef-9939-7962a398f001",
    "status": "queued",
    "statusUrl": "/v1/creator/product-imports/01989f72-3d78-78ef-9939-7962a398f001"
  },
  "meta": {
    "requestId": "01989f72-17a0-772b-a333-c3b95d0e5001"
  }
}
```

## 6. Error contract

Errors follow Problem Details semantics and use stable VibesHub codes.

```json
{
  "type": "https://api.vibeshub.com/problems/invalid-state-transition",
  "title": "The recommendation cannot be published",
  "status": 409,
  "code": "INVALID_STATE_TRANSITION",
  "detail": "The attached story clip is still processing.",
  "instance": "/v1/creator/recommendations/01989f72-07e4-7f32-9b42-1ba55d4ca001/publish",
  "requestId": "01989f72-17a0-772b-a333-c3b95d0e5001",
  "errors": [
    {
      "field": "storyClips[0]",
      "code": "MEDIA_NOT_READY",
      "message": "Wait for processing to finish or remove this clip."
    }
  ]
}
```

Stable codes include:

| HTTP | Code                       | Meaning                                    |
| ---- | -------------------------- | ------------------------------------------ |
| 400  | `MALFORMED_REQUEST`        | Invalid JSON or protocol input             |
| 401  | `AUTHENTICATION_REQUIRED`  | Missing/invalid authentication             |
| 403  | `CAPABILITY_REQUIRED`      | Valid account lacks capability             |
| 403  | `OWNERSHIP_REQUIRED`       | Resource belongs to another user           |
| 403  | `ACCOUNT_RESTRICTED`       | Account state blocks action                |
| 404  | `RESOURCE_NOT_FOUND`       | Missing or deliberately concealed resource |
| 409  | `INVALID_STATE_TRANSITION` | Workflow command is invalid now            |
| 409  | `RESOURCE_CONFLICT`        | Unique/domain conflict                     |
| 409  | `IDEMPOTENCY_CONFLICT`     | Key reused for different request           |
| 412  | `VERSION_CONFLICT`         | `If-Match` or version is stale             |
| 413  | `PAYLOAD_TOO_LARGE`        | Request or declared upload exceeds limit   |
| 415  | `UNSUPPORTED_MEDIA_TYPE`   | Unsupported request/upload type            |
| 422  | `VALIDATION_FAILED`        | Structured domain validation failed        |
| 422  | `URL_NOT_ALLOWED`          | Merchant URL/domain is not allowed         |
| 422  | `IMPORT_UNSUPPORTED`       | Merchant/page cannot be imported           |
| 422  | `MEDIA_NOT_READY`          | Required media is not ready/approved       |
| 429  | `RATE_LIMITED`             | Retry after returned time                  |
| 503  | `DEPENDENCY_UNAVAILABLE`   | Required provider temporarily unavailable  |

Production errors never include stack traces, SQL, secrets, provider credentials, private moderation notes, or raw third-party bodies.

## 7. Shared public DTOs

### Money

```json
{
  "amount": "120.00",
  "currency": "ILS"
}
```

### Media image

```json
{
  "assetId": "01989f72-07e4-7f32-9b42-1ba55d4ca002",
  "alt": "Rare Beauty blush compact",
  "renditions": {
    "card": {
      "url": "https://media.vibeshub.com/...",
      "width": 800,
      "height": 1000,
      "format": "webp"
    }
  }
}
```

### Story preview

```json
{
  "mediaAssetId": "01989f72-07e4-7f32-9b42-1ba55d4ca003",
  "status": "ready",
  "coverUrl": "https://media.vibeshub.com/...",
  "durationMs": 18500,
  "position": 0
}
```

The public API does not expose raw storage keys, provider asset-management IDs, upload URLs, or moderation evidence.

### Creator card

```json
{
  "id": "01989f72-07e4-7f32-9b42-1ba55d4ca010",
  "handle": "noa-levi",
  "displayName": "Noa Levi",
  "avatar": {},
  "primaryCategory": {
    "slug": "beauty",
    "name": "Beauty"
  },
  "bio": {
    "text": "המלצות אמיתיות על מוצרי טיפוח ואיפור שאני משתמשת בהם ביום יום",
    "locale": "he",
    "direction": "rtl"
  },
  "verificationStatus": "verified",
  "followerCount": 124000,
  "recommendationCount": 148
}
```

Counts are numeric platform projections and may be approximate/cached. Social-platform follower counts are labeled separately when shown.

### Creator-specific recommendation card

```json
{
  "id": "01989f72-07e4-7f32-9b42-1ba55d4ca020",
  "product": {
    "id": "01989f72-07e4-7f32-9b42-1ba55d4ca021",
    "slug": "rare-beauty-soft-pinch-liquid-blush",
    "name": "Soft Pinch Liquid Blush",
    "brand": {
      "id": "01989f72-07e4-7f32-9b42-1ba55d4ca022",
      "name": "Rare Beauty"
    },
    "primaryImage": {}
  },
  "offer": {
    "price": {
      "amount": "120.00",
      "currency": "ILS"
    },
    "priceSource": "merchantPage",
    "observedAt": "2026-08-06T18:10:00Z",
    "freshness": "current",
    "availability": "unknown"
  },
  "review": {
    "text": "המוצר האהוב עליי למראה טבעי וזוהר",
    "locale": "he",
    "direction": "rtl",
    "displayMaxLines": 5
  },
  "creator": {},
  "storyPreviews": [],
  "discountCode": null,
  "commercialRelationship": "affiliate",
  "shopUrl": "https://vibeshub.com/go/01989f72-07e4-7f32-9b42-1ba55d4ca023",
  "publishedAt": "2026-08-06T18:30:00Z"
}
```

`displayMaxLines` communicates the card contract; clients still clamp according to their rendering system and offer a full-text detail view.

### Aggregated product card

Trending and most-saved feeds return a canonical product, a lead recommendation, up to three creator summaries, total recommending-creator count, selected offer, visible code/story indicators, and a detail URL. They do not merge multiple creator reviews into one text.

## 8. Public discovery endpoints

| Method | Path                                    | Authentication | Purpose                                            |
| ------ | --------------------------------------- | -------------- | -------------------------------------------------- |
| GET    | `/configuration`                        | None           | Public client configuration and supported versions |
| GET    | `/categories`                           | None           | Active category cards                              |
| GET    | `/categories/{slug}`                    | None           | Category detail                                    |
| GET    | `/categories/{slug}/creators`           | None           | Cursor-paginated creators                          |
| GET    | `/categories/{slug}/products`           | None           | Cursor-paginated product aggregates                |
| GET    | `/creators`                             | None           | Creator directory with category/search filters     |
| GET    | `/creators/{handle}`                    | None           | Public creator storefront header                   |
| GET    | `/creators/{handle}/recommendations`    | None           | Published creator recommendations                  |
| GET    | `/creators/{handle}/discount-codes`     | None           | Visible current codes                              |
| GET    | `/creators/{handle}/videos`             | None           | Published standalone videos                        |
| GET    | `/products/{productId}`                 | None           | Canonical product detail                           |
| GET    | `/products/{productId}/recommendations` | None           | Recommending creators/reviews                      |
| GET    | `/recommendations/{recommendationId}`   | None           | Full recommendation detail                         |
| GET    | `/trending/products`                    | None           | Precomputed trending product feed                  |
| GET    | `/selected/most-saved`                  | None           | Editorial/aggregate most-saved feed                |
| GET    | `/search`                               | None           | Unified creator/product/brand/category search      |
| POST   | `/analytics/client-events`              | Optional       | Allowlisted low-trust client event batch           |
| POST   | `/reports`                              | Shopper        | Report public content                              |

Public endpoints return published and approved fields only. A suspended or hidden object is returned as not found unless a staff endpoint is used.

### Search query parameters

```text
GET /v1/search?q=rare%20beauty&type=creator,product&category=beauty&limit=20&cursor=...
```

Rules:

- `q` has a bounded normalized length.
- `type`, category, and limit use allowlisted values.
- cursors bind to the query/filter fingerprint and cannot be reused for a different query.
- search results contain typed cards and server-computed result URLs.

## 9. Redirect endpoint

```text
GET https://vibeshub.com/go/{affiliatePublicId}
```

This endpoint is intentionally outside the JSON `/v1` surface.

- Resolve only active allowlisted destinations.
- Do not accept a destination URL from query parameters.
- Append only approved attribution parameters.
- Record/enqueue the server-authoritative `shop_clicked` event under a strict latency budget.
- Return `302` or `307` according to redirect policy.
- Return a safe VibesHub error page for blocked or invalid destinations.
- Never become a generic open redirect.

## 10. Authenticated shopper endpoints

| Method    | Path                                        | Purpose                                            |
| --------- | ------------------------------------------- | -------------------------------------------------- |
| GET       | `/me`                                       | Account, capabilities, creator/application summary |
| GET/PATCH | `/me/profile`                               | Shopper display profile                            |
| POST      | `/me/engagement-state`                      | Batched save/follow state for one rendered page    |
| GET       | `/me/saved-products`                        | Cursor-paginated saves                             |
| PUT       | `/me/saved-products/{productId}`            | Idempotently save product                          |
| DELETE    | `/me/saved-products/{productId}`            | Idempotently remove save                           |
| GET       | `/me/followed-creators`                     | Cursor-paginated follows                           |
| PUT       | `/me/followed-creators/{creatorId}`         | Idempotently follow                                |
| DELETE    | `/me/followed-creators/{creatorId}`         | Idempotently unfollow                              |
| GET       | `/me/notifications`                         | Cursor-paginated notifications                     |
| POST      | `/me/notifications/{notificationId}/read`   | Mark notification read                             |
| GET/PATCH | `/me/notification-preferences`              | Channel/type preferences                           |
| POST      | `/me/device-installations`                  | Register/update push installation                  |
| DELETE    | `/me/device-installations/{installationId}` | Revoke installation                                |
| POST      | `/me/data-exports`                          | Request asynchronous export                        |
| GET       | `/me/data-exports/{operationId}`            | Export status                                      |
| POST      | `/me/account-deletion`                      | Request deletion after reauthentication            |
| GET       | `/me/account-deletion`                      | Deletion status                                    |
| DELETE    | `/me/account-deletion`                      | Cancel while policy allows                         |

Save and follow PUT/DELETE operations are naturally idempotent and do not expose other users' private relations.

## 11. Creator application endpoints

| Method | Path                                      | Purpose                                        |
| ------ | ----------------------------------------- | ---------------------------------------------- |
| POST   | `/creator-applications`                   | Create draft application                       |
| GET    | `/creator-applications/current`           | Current user's application                     |
| PATCH  | `/creator-applications/{id}`              | Edit owned draft/changes-requested application |
| PUT    | `/creator-applications/{id}/social-links` | Replace validated application links            |
| POST   | `/creator-applications/{id}/submit`       | Validate and submit                            |
| POST   | `/creator-applications/{id}/withdraw`     | Withdraw eligible application                  |

Submitting and withdrawing are commands, not arbitrary status patches.

## 12. Creator studio endpoints

All routes require an approved creator capability and ownership of the resolved creator profile.

### Profile/storefront

| Method    | Path                            | Purpose                                 |
| --------- | ------------------------------- | --------------------------------------- |
| GET/PATCH | `/creator/profile`              | Manage public profile draft             |
| PUT       | `/creator/profile/categories`   | Replace ordered categories              |
| PUT       | `/creator/profile/social-links` | Replace ordered validated links         |
| POST      | `/creator/profile/submit`       | Submit profile changes requiring review |
| GET       | `/creator/storefront-preview`   | Preview draft/published projection      |

### Product importing

| Method | Path                                         | Purpose                               |
| ------ | -------------------------------------------- | ------------------------------------- |
| POST   | `/creator/product-imports`                   | Queue import from supported HTTPS URL |
| GET    | `/creator/product-imports/{importId}`        | Poll import state/result              |
| POST   | `/creator/product-imports/{importId}/cancel` | Cancel if not terminal                |

Create request:

```json
{
  "sourceUrl": "https://merchant.example/products/rare-beauty-blush"
}
```

Ready result returns an editable product/offer candidate, extraction provenance, warnings, and permitted image candidates. It never publishes a product or recommendation.

### Recommendations

| Method | Path                                           | Purpose                                         |
| ------ | ---------------------------------------------- | ----------------------------------------------- |
| GET    | `/creator/recommendations`                     | Creator content by lifecycle status             |
| POST   | `/creator/recommendations`                     | Create draft from product/offer or ready import |
| GET    | `/creator/recommendations/{id}`                | Creator-owned editable detail                   |
| PATCH  | `/creator/recommendations/{id}`                | Update draft with `If-Match`                    |
| PUT    | `/creator/recommendations/{id}/media`          | Replace ordered owned media placements          |
| PUT    | `/creator/recommendations/{id}/discount-codes` | Replace visible owned code placements           |
| POST   | `/creator/recommendations/{id}/submit`         | Submit for moderation/publication               |
| POST   | `/creator/recommendations/{id}/publish`        | Publish when policy permits                     |
| POST   | `/creator/recommendations/{id}/unpublish`      | Remove from public feeds                        |
| POST   | `/creator/recommendations/{id}/archive`        | Archive eligible content                        |

The server validates that selected offer belongs to the product, media belongs to the creator and is ready, codes are compatible, and disclosure is supplied.

### Discount codes

| Method    | Path                                    | Purpose                                   |
| --------- | --------------------------------------- | ----------------------------------------- |
| GET       | `/creator/discount-codes`               | List owned codes                          |
| POST      | `/creator/discount-codes`               | Create draft code                         |
| GET/PATCH | `/creator/discount-codes/{id}`          | Read/update with ownership/version checks |
| PUT       | `/creator/discount-codes/{id}/products` | Replace product scope                     |
| POST      | `/creator/discount-codes/{id}/submit`   | Submit/verify according to policy         |
| POST      | `/creator/discount-codes/{id}/hide`     | Remove from storefront                    |
| POST      | `/creator/discount-codes/{id}/confirm`  | Creator confirmation with timestamp       |
| POST      | `/creator/discount-codes/{id}/archive`  | Archive code                              |

### Media and standalone videos

| Method    | Path                                              | Purpose                                             |
| --------- | ------------------------------------------------- | --------------------------------------------------- |
| POST      | `/creator/media/image-uploads`                    | Create media record and signed direct upload        |
| POST      | `/creator/media/image-uploads/{assetId}/complete` | Declare upload completion for validation            |
| POST      | `/creator/media/video-uploads`                    | Create media record and Mux direct upload           |
| GET       | `/creator/media/{assetId}`                        | Processing/moderation state                         |
| DELETE    | `/creator/media/{assetId}`                        | Request deletion if ownership/reference rules allow |
| GET/POST  | `/creator/videos`                                 | List/create standalone video draft                  |
| GET/PATCH | `/creator/videos/{id}`                            | Read/update video draft                             |
| POST      | `/creator/videos/{id}/submit`                     | Submit for moderation                               |
| POST      | `/creator/videos/{id}/publish`                    | Publish when permitted                              |
| POST      | `/creator/videos/{id}/unpublish`                  | Remove from public feeds                            |

Upload creation returns provider URL, required method/headers, expiry, maximum bytes, and allowed MIME types. Temporary upload credentials are returned only to the owner and never included in later GET responses.

### Creator analytics

| Method | Path                                 | Purpose                    |
| ------ | ------------------------------------ | -------------------------- |
| GET    | `/creator/analytics/summary`         | Date-range metrics cards   |
| GET    | `/creator/analytics/timeseries`      | Daily metrics series       |
| GET    | `/creator/analytics/recommendations` | Per-recommendation metrics |
| GET    | `/creator/analytics/links`           | Outbound link metrics      |

Maximum range and aggregation granularity are server-controlled. Creator analytics exposes only the creator's own aggregate data, never another visitor's identity.

## 13. Administration and moderation endpoints

Admin routes require staff capability, stronger rate limits, audit recording, and appropriate step-up controls.

### Applications

| Method | Path                                               | Capability | Purpose                                   |
| ------ | -------------------------------------------------- | ---------- | ----------------------------------------- |
| GET    | `/admin/creator-applications`                      | Moderator  | Review queue                              |
| GET    | `/admin/creator-applications/{id}`                 | Moderator  | Full application/evidence                 |
| POST   | `/admin/creator-applications/{id}/start-review`    | Moderator  | Claim/start review                        |
| POST   | `/admin/creator-applications/{id}/request-changes` | Moderator  | Applicant-visible request                 |
| POST   | `/admin/creator-applications/{id}/approve`         | Moderator  | Create creator/capability transactionally |
| POST   | `/admin/creator-applications/{id}/reject`          | Moderator  | Reject with reason                        |

### Moderation

| Method | Path                                   | Capability | Purpose                    |
| ------ | -------------------------------------- | ---------- | -------------------------- |
| GET    | `/admin/moderation/cases`              | Moderator  | Filtered queue             |
| GET    | `/admin/moderation/cases/{id}`         | Moderator  | Case detail/history        |
| POST   | `/admin/moderation/cases/{id}/assign`  | Moderator  | Assign case                |
| POST   | `/admin/moderation/cases/{id}/actions` | Moderator  | Perform allowlisted action |
| GET    | `/admin/reports`                       | Moderator  | Reports queue              |
| POST   | `/admin/reports/{id}/attach`           | Moderator  | Attach to case             |

### Catalog and operations

| Method   | Path                                   | Capability    | Purpose                             |
| -------- | -------------------------------------- | ------------- | ----------------------------------- |
| GET/POST | `/admin/merchants`                     | Administrator | Manage merchant registry            |
| GET      | `/admin/merchant-domains`              | Administrator | Paginated domain review queue       |
| POST     | `/admin/merchant-domains/{id}/approve` | Administrator | Grant explicit domain permissions   |
| POST     | `/admin/merchant-domains/{id}/reject`  | Administrator | Reject a pending domain with reason |
| POST     | `/admin/merchant-domains/{id}/disable` | Administrator | Revoke and block domain access      |
| GET      | `/admin/products/candidates`           | Moderator     | Product candidate queue             |
| POST     | `/admin/products/{id}/merge`           | Administrator | Merge duplicate product             |
| POST     | `/admin/brands/{id}/merge`             | Administrator | Merge duplicate brand               |
| POST     | `/admin/discount-codes/{id}/verify`    | Moderator     | Staff/merchant verification         |
| GET      | `/admin/imports/{id}`                  | Moderator     | Import diagnostics, redacted        |
| GET      | `/admin/audit`                         | Administrator | Filtered immutable audit query      |

Staff actions use command-specific DTOs. No endpoint accepts arbitrary table names, field maps, SQL-like filters, or unrestricted status assignment.

## 14. Webhook and internal endpoints

| Method | Path                             | Authentication                    | Purpose                       |
| ------ | -------------------------------- | --------------------------------- | ----------------------------- |
| POST   | `/webhooks/mux`                  | Mux signature                     | Video events                  |
| POST   | `/webhooks/affiliate/{provider}` | Provider signature                | Conversion/link events        |
| POST   | `/internal/jobs/{jobType}`       | Cloud Tasks OIDC + network policy | Worker delivery               |
| POST   | `/internal/outbox/dispatch`      | Scheduler/IAM                     | Publish pending outbox events |
| GET    | `/health/live`                   | Infrastructure                    | Process liveness only         |
| GET    | `/health/ready`                  | Infrastructure                    | Required dependency readiness |

Webhook handlers validate body bytes before JSON transformation, persist unique provider event IDs, acknowledge quickly, and process idempotently.

Health endpoints reveal no secrets, database names, provider keys, build environment values, or detailed dependency errors to the public internet.

## 15. State-transition commands

Clients cannot PATCH lifecycle fields directly. Commands enforce legal transitions.

Example recommendation transitions:

```text
draft -> submitted
submitted -> published       when moderation policy approves
submitted -> rejected
rejected -> draft            after creator edits
published -> draft/hidden    unpublish
draft|rejected -> archived
published -> blocked         moderator action
blocked -> published         moderator restore
```

Every command returns the resulting resource, updated version, and any asynchronous operation or review state.

## 16. Optimistic concurrency

Mutable creator/admin resources return:

```text
ETag: "recommendation:01989f72-...:7"
```

Updates and commands that can overwrite another edit require:

```text
If-Match: "recommendation:01989f72-...:7"
```

Stale updates return `412 VERSION_CONFLICT` with the current resource version but not private fields the caller cannot access.

## 17. Idempotency

`Idempotency-Key` is required for:

- creator application creation/submission
- product import creation
- recommendation creation and state commands
- code creation/state commands
- upload creation
- reports
- exports/deletion
- administrative decisions

The key is scoped to authenticated actor, route, and request-body hash. Replaying the same request returns the stored result. Reusing a key with different input returns `409 IDEMPOTENCY_CONFLICT`.

## 18. Rate-limit classes

| Class                | Examples                    | Primary dimensions                   |
| -------------------- | --------------------------- | ------------------------------------ |
| Public reads         | feeds, creators, categories | IP/network, anonymous session, route |
| Search               | unified search              | IP/user, normalized query rate       |
| Authenticated writes | saves, follows, reports     | user, route                          |
| Creator writes       | imports, uploads, publish   | user, creator, route, storage quota  |
| Redirect             | `/go/{id}`                  | IP/network, link, abuse signals      |
| Webhooks             | provider endpoints          | provider, signature, event ID        |
| Admin                | moderation/catalog          | staff user, action sensitivity       |

Responses include `Retry-After` where useful. Limits are server-configured and not encoded into client behavior as permanent constants.

## 19. Field-level privacy

Public DTOs exclude:

- email, auth providers, device tokens, consent evidence
- private social/application evidence
- moderation notes and reporter identity
- storage object keys and upload authorization
- raw analytics identifiers, IP addresses, and session identifiers
- affiliate credentials and provider secrets
- account deletion/export state for other users

Admin DTOs remain purpose-specific; staff capability does not automatically return every sensitive field.

## 20. OpenAPI implementation rules

During scaffolding:

- define request and response schemas once in `packages/contracts`
- generate an OpenAPI document in CI
- generate or infer typed web/native clients from that document
- fail CI when implemented routes drift from the published contract
- include examples for money, Hebrew direction, cursor pagination, asynchronous operations, and errors
- tag operations by module and required capability
- mark internal/webhook operations separately from public client operations
- lint for operation IDs, documented errors, authentication, and schema reuse
