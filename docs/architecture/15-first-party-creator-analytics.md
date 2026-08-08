# First-party creator analytics slice

**Status:** Implemented

**Date:** 2026-08-08

## Outcome

VibesHub now measures the first creator commerce funnel without a third-party analytics dependency:

1. creator storefront view;
2. recommendation impression after at least 50% visibility for one continuous second;
3. successful discount-code copy;
4. valid outbound shop redirect.

The NestJS API remains the shared backend for web and future native clients. The worker remains undeployed.

## Data flow

- Web and future native clients send strict versioned batches to `POST /v1/analytics/client-events`.
- The API validates time, event shape, entity relationships, publication state, and discount-code truth before accepting an event.
- Browser identifiers are random per browser session. The API transforms them with a database-held, rotatable HMAC key before durable storage. Raw identifiers and IP addresses are never written to analytics events.
- A client event ID receipt makes retries idempotent. Recommendation views and the privacy-conscious unique-session metric are additionally deduplicated per session and UTC day.
- `affiliate.shopClicked` is written only after the redirect service has resolved a valid, allowlisted destination. Analytics failure never blocks that redirect.
- Append-only raw events are monthly partitioned. Creator, recommendation, and link daily projections power the dashboard.

## Creator dashboard

`GET /v1/creator/analytics?days=7|30|90` requires `creator:view_analytics` and derives creator ownership from the verified Supabase JWT. It returns:

- storefront visits;
- privacy-conscious unique visitor sessions;
- qualified recommendation views;
- server-authoritative shop clicks;
- successful code copies;
- a daily series and the creator's top recommendations.

No shopper identity, session hash, IP address, or raw event is returned.

## Initial operating model

At launch volume, accepted events update small daily projection rows inside the same database transaction. This avoids deploying or paying for a worker before it is necessary. The event and API contracts are already separated from projection mechanics; a future worker can consume raw events, reconcile aggregates, maintain future partitions, and enforce retention without changing clients.

Operational follow-ups before higher traffic:

- automate monthly partition creation and bounded raw-event retention;
- clean expired ingestion rate-limit rows and old deduplication rows;
- add reconciliation jobs and aggregate versioning;
- move projection work to the worker when measured API latency or write volume warrants it.
