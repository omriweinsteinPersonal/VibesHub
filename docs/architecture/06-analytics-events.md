# VibesHub analytics event contracts

**Status:** Accepted baseline

**Date:** 2026-08-06

## 1. Principles

- Creator-visible metrics come from stable business events, not arbitrary UI analytics.
- Server-authoritative events are preferred whenever the server observes the action.
- Client events are untrusted, schema-validated, rate-limited, deduplicated, and never directly increment public counters.
- Analytics collection must not block shopping redirects or core writes.
- Events contain the minimum data required for attribution, product decisions, reliability, and abuse detection.
- Raw event retention is bounded; dashboards read aggregates.
- Sponsored/affiliate attribution is recorded explicitly rather than inferred from card position.

PostHog or another product-analytics tool may receive a privacy-filtered subset for internal product analysis. PostgreSQL/derived VibesHub events remain the source for creator-facing business metrics.

## 2. Event envelope

```json
{
  "eventId": "01989f72-3d78-78ef-9939-7962a398f001",
  "eventName": "recommendation.viewed",
  "schemaVersion": 1,
  "occurredAt": "2026-08-06T18:30:00Z",
  "receivedAt": "2026-08-06T18:30:01Z",
  "source": "web",
  "authority": "client",
  "actor": {
    "userId": null,
    "anonymousId": "client-generated-rotating-id",
    "sessionId": "01989f72-07e4-7f32-9b42-1ba55d4ca001"
  },
  "context": {
    "creatorId": "01989f72-07e4-7f32-9b42-1ba55d4ca010",
    "recommendationId": "01989f72-07e4-7f32-9b42-1ba55d4ca020",
    "productId": "01989f72-07e4-7f32-9b42-1ba55d4ca021",
    "affiliateLinkId": null
  },
  "surface": {
    "name": "creatorStorefront",
    "position": 3,
    "requestId": "01989f72-17a0-772b-a333-c3b95d0e5001"
  },
  "properties": {}
}
```

The ingestion service replaces the raw anonymous identifier with a keyed/rotatable pseudonymous representation before durable storage. Raw client identifiers are not returned through creator analytics.

## 3. Field rules

| Field              | Rule                                                            |
| ------------------ | --------------------------------------------------------------- |
| `eventId`          | Client UUID for client events; server UUID for server events    |
| `eventName`        | Registered stable name only                                     |
| `schemaVersion`    | Positive integer with strict schema                             |
| `occurredAt`       | Bounded clock skew; server may correct/reject implausible time  |
| `receivedAt`       | Server assigned                                                 |
| `source`           | `web`, `ios`, `android`, `server`, `partner`                    |
| `authority`        | Server assigned: `client`, `domain`, `redirect`, `provider`     |
| `userId`           | Derived from verified token, never trusted from body            |
| `anonymousId`      | Optional client rotating identifier; transformed before storage |
| `sessionId`        | Bounded session identifier, not authentication                  |
| Context IDs        | Checked against allowed relationships when practical            |
| `surface.name`     | Allowlisted UI surface                                          |
| `surface.position` | Non-negative and bounded; never determines paid/organic status  |
| `properties`       | Event-specific schema; no arbitrary nested payload              |

## 4. Authority classes

### Domain-authoritative

Emitted after a successful API transaction:

- follows and unfollows
- saves and unsaves
- reports
- creator application submission
- content submission/publication/unpublication
- code creation/confirmation

### Redirect-authoritative

Emitted only by the outbound redirect service:

- shop clicks
- blocked redirect attempts

### Provider-authoritative

Emitted from verified external callbacks:

- affiliate conversion
- media processing result
- push/email delivery result

### Client-observed

Used when only the client can observe the interaction:

- impressions meeting visibility rules
- story opens, progress, completion, and close
- code copy action
- search submission and result selection
- category/storefront screen views

Client-observed events are eligible for filtering and fraud adjustment before creator metrics.

## 5. Public discovery events

| Event                       | Authority     | Required context                          | Definition                                                   |
| --------------------------- | ------------- | ----------------------------------------- | ------------------------------------------------------------ |
| `page.viewed`               | Client        | Surface, canonical route type             | Route became visible and active                              |
| `category.viewed`           | Client        | Category ID                               | Category page visible                                        |
| `creator.storefrontViewed`  | Client        | Creator ID                                | Storefront header visible after navigation settled           |
| `recommendation.impression` | Client        | Creator, recommendation, product          | Card at least 50% visible for at least one continuous second |
| `recommendation.opened`     | Client        | Recommendation, product                   | Detail/story surface intentionally opened                    |
| `product.opened`            | Client        | Product ID                                | Product detail intentionally opened                          |
| `search.performed`          | Client/server | Search operation ID                       | Valid search request executed                                |
| `search.resultSelected`     | Client        | Search operation ID, entity type/ID, rank | User selected a result                                       |

One client session emits at most one impression for the same recommendation and surface-render instance. Virtualized list recycling must not create new impressions without a new render/view window.

## 6. Community events

| Event                   | Authority              | Required context                        | Metric use                    |
| ----------------------- | ---------------------- | --------------------------------------- | ----------------------------- |
| `creator.followed`      | Domain                 | Creator, authenticated user             | Creator follower count/growth |
| `creator.unfollowed`    | Domain                 | Creator, authenticated user             | Creator follower count/growth |
| `product.saved`         | Domain                 | Product, optional source recommendation | Saves and attribution         |
| `product.unsaved`       | Domain                 | Product                                 | Net saves                     |
| `content.reported`      | Domain                 | Target type/ID, reason code             | Trust operations only         |
| `socialProfile.clicked` | Client/domain redirect | Creator, platform                       | Creator social click metric   |

Public follower/save counters derive from current relation counts or reconciled aggregates, not by blindly adding event deltas.

## 7. Story and media events

| Event                  | Authority | Required properties                   | Definition                                   |
| ---------------------- | --------- | ------------------------------------- | -------------------------------------------- |
| `story.opened`         | Client    | Creator, recommendation, product      | Story viewer entered                         |
| `story.progressed`     | Client    | Asset ID, quartile                    | First crossing of 25/50/75 percent           |
| `story.completed`      | Client    | Recommendation, watchedMs, durationMs | At least 90% watched or natural playback end |
| `story.closed`         | Client    | Asset ID, watchedMs, closeReason      | Viewer left before/after completion          |
| `video.playbackFailed` | Client    | Asset ID, stable error code           | Product reliability, not creator performance |

Clients do not send a high-frequency event for every playback second. Progress uses bounded milestones.
The compatibility viewer binds events to a published recommendation until controlled
Mux assets provide a durable media asset ID; the API validates the full
creator/recommendation/product relationship in either case.

## 8. Discount and commerce events

| Event                          | Authority | Required context                             | Definition                                        |
| ------------------------------ | --------- | -------------------------------------------- | ------------------------------------------------- |
| `discountCode.copied`          | Client    | Code ID, recommendation ID optional          | Copy action completed                             |
| `affiliate.shopClicked`        | Redirect  | Link, creator, recommendation, product       | Valid outbound redirect issued                    |
| `affiliate.redirectBlocked`    | Redirect  | Link ID, stable reason                       | Destination not issued; operational/security only |
| `affiliate.conversionRecorded` | Provider  | Provider conversion ID, link/click reference | Verified partner conversion                       |
| `affiliate.conversionReversed` | Provider  | Provider reversal ID/reference               | Verified reversal/cancellation                    |

Creator dashboards label clicks as clicks. They do not label them purchases unless a provider-authoritative conversion exists.

## 9. Creator lifecycle events

These are operational/product events and are not exposed as creator traffic metrics.

| Event                                 | Authority       |
| ------------------------------------- | --------------- |
| `creatorApplication.created`          | Domain          |
| `creatorApplication.submitted`        | Domain          |
| `creatorApplication.changesRequested` | Domain          |
| `creatorApplication.approved`         | Domain          |
| `creatorApplication.rejected`         | Domain          |
| `recommendation.created`              | Domain          |
| `recommendation.submitted`            | Domain          |
| `recommendation.published`            | Domain          |
| `recommendation.unpublished`          | Domain          |
| `discountCode.published`              | Domain          |
| `discountCode.expired`                | Domain/job      |
| `media.uploadStarted`                 | Domain          |
| `media.ready`                         | Provider/domain |
| `media.failed`                        | Provider/domain |

## 10. Client event ingestion

```text
POST /v1/analytics/client-events
```

```json
{
  "batchId": "01989f72-3d78-78ef-9939-7962a398f001",
  "events": []
}
```

Rules:

- bounded batch count and byte size
- same source/client installation within a batch
- allowlisted event names and versions
- user identity derived from token when present
- anonymous/session identifiers bounded and syntactically validated
- old, future, duplicate, and malformed events rejected or quarantined
- per-event acceptance response only when needed; otherwise batch summary
- rate limits by session, account, network, and app version
- ingestion returns quickly; the initial low-volume release updates bounded daily projections in the same database transaction
- SDK queues briefly while offline but respects maximum event age

Analytics failure never blocks navigation, save/follow domain commands, story playback, or outbound shopping.

The stable event and dashboard contracts do not depend on the initial projection strategy. When traffic justifies deploying the worker, ingestion can append events and move projection/reconciliation work to idempotent background jobs without changing web or mobile clients.

## 11. Search-query privacy

Search text can contain names, health concerns, or other personal information.

- Operational search executes the query but does not write it to general application logs.
- Creator dashboards never expose raw shopper search text.
- Product analytics receives query length, language estimate, result count, filters, and a server-generated search operation ID by default.
- Retaining normalized query text for search-quality analysis requires an approved purpose, restricted dataset, short retention, access control, and redaction process.
- Query hashes are useful for frequency comparison but are still treated as potentially identifying when the input space is guessable.

## 12. Metric definitions

### Storefront visits

Count accepted `creator.storefrontViewed` events. Retries reuse the event ID and are deduplicated; a later page load is a new visit.

### Unique visitors

Daily distinct authenticated user ID or pseudonymous browser-session identifier after consent/collection rules. A person using several devices or sessions may count more than once; UI copy must not claim exact human identity.

### Recommendation views

Accepted `recommendation.impression` events meeting visibility and abuse filters.

### Product clicks

Server-authoritative `affiliate.shopClicked` events that resulted in a merchant redirect.

### Code clicks/copies

Accepted `discountCode.copied` client events. This means a copy interaction, not verified code usage.

### Instagram/social taps

Clicks on a creator social destination through a VibesHub-controlled action/redirect.

### Story completion rate

Accepted completions divided by accepted opens for the same asset and date window, with incomplete telemetry labeled when applicable.

## 13. Aggregation contract

- Raw events are immutable after validation except permitted privacy deletion/anonymization.
- Aggregation checkpoints are stored by metric date, event partition, and aggregate version.
- Jobs are idempotent and can recompute a date range.
- Late events update eligible recent dates within a defined lateness window.
- Provider reversals apply compensating aggregate changes rather than mutating original events.
- Aggregate version changes write/recompute explicitly and do not silently mix formulas.
- Creator timezone affects display grouping only when specified; storage checkpoints remain UTC/date-defined.

## 14. Trending inputs

Eligible signals may include:

- unique recommendation views
- unique saves
- outbound shop clicks
- code copies
- story completions
- distinct approved creators recommending a product
- recency decay
- editorial eligibility

Signals excluded or heavily discounted:

- raw repeated impressions from one session/network
- self-traffic from the creator/admin surfaces
- unverified partner conversion events
- events from blocked app versions or identified automation
- paid/sponsored influence not explicitly represented by policy

Trending score components and algorithm version are stored for explainability and rollback.

## 15. Fraud and quality controls

- Deduplicate events by event ID and authority-specific key.
- Exclude known internal, health-check, preview, admin, and test traffic.
- Rate-limit implausible event velocity.
- Detect repeated click/follow/save patterns by pseudonymous signals.
- Reconcile domain events against current save/follow tables.
- Reconcile affiliate clicks against redirect logs/event receipts.
- Flag rather than automatically punish ambiguous creator traffic.
- Never expose fraud thresholds or individual shopper identifiers to creators.

## 16. Data classification and retention

| Data                          | Classification                | Initial policy direction                 |
| ----------------------------- | ----------------------------- | ---------------------------------------- |
| Event name, target public IDs | Internal                      | Retain for bounded analytical need       |
| Authenticated user ID         | Confidential                  | Minimize; delete/anonymize by policy     |
| Anonymous/session identifier  | Confidential/pseudonymous     | Rotate and retain briefly                |
| Raw search text               | Potentially restricted        | Do not retain by default                 |
| Aggregate creator metrics     | Internal/creator-confidential | Retain for creator history               |
| Provider conversion reference | Confidential                  | Retain per commercial/legal need         |
| Full IP address               | Restricted                    | Do not place in general analytics events |

Exact durations require privacy/legal approval before production. The implementation must make retention configurable and support partition deletion, account deletion, and aggregate preservation only where policy permits.

## 17. Event registry governance

Every new or changed event requires:

- owner module
- description and business purpose
- authority class
- schema/version
- required/optional fields
- privacy classification
- retention class
- deduplication rule
- creator metric impact, if any
- tests and sample payload

Clients cannot invent event names dynamically. Deprecated events remain documented through their retention and compatibility window.
