# VibesHub background-job contracts

**Status:** Accepted baseline

**Date:** 2026-08-06

## 1. Delivery model

VibesHub uses at-least-once asynchronous delivery. Exactly-once execution is not assumed.

1. A domain transaction writes its business state and `ops.outbox_events` row atomically.
2. The outbox dispatcher publishes an authenticated Google Cloud Task.
3. Cloud Tasks invokes the private worker endpoint.
4. The worker claims an idempotency key and processes the job.
5. Successful completion records execution state and acknowledges delivery.
6. Retriable failure returns a retriable response; terminal failure is persisted and surfaced operationally.

Directly received provider webhooks use an inbox pattern: validate, deduplicate, persist receipt, acknowledge, and process asynchronously.

## 2. Job envelope

```json
{
  "jobId": "01989f72-3d78-78ef-9939-7962a398f001",
  "jobType": "catalog.product-import.requested",
  "jobVersion": 1,
  "idempotencyKey": "product-import:01989f72-3d78-78ef-9939-7962a398f002:v1",
  "occurredAt": "2026-08-06T18:30:00Z",
  "availableAt": "2026-08-06T18:30:00Z",
  "traceId": "01989f72-17a0-772b-a333-c3b95d0e5001",
  "actor": {
    "type": "user",
    "id": "01989f72-07e4-7f32-9b42-1ba55d4ca001"
  },
  "data": {}
}
```

Rules:

- `jobType` and `jobVersion` select a strict payload schema.
- Payloads contain identifiers and immutable decision context, not large media or secrets.
- Workers reload current mutable state before acting.
- Actor may be `user`, `system`, `provider`, or `staff`.
- Trace IDs flow from originating requests or webhook receipts.
- Delivery attempt is supplied by infrastructure/headers and recorded by the worker, not trusted from payload data.

## 3. Worker endpoint authentication

```text
POST /v1/internal/jobs/{jobType}
```

- Cloud Tasks uses OIDC with a dedicated service identity.
- Audience must exactly match the worker service.
- Internet requests without valid service identity are rejected.
- Path job type must match envelope job type.
- Body size and content type are bounded.
- Worker authorization is independent of end-user tokens.
- Job endpoint responses expose minimal details; full errors go to structured logs and execution records.

## 4. Retry classification

### Retriable

- dependency timeout
- temporary DNS/network failure
- provider `429`
- provider `5xx`
- database connection exhaustion
- optimistic lock caused by another worker when retry is safe
- transient media/search service failure

### Terminal

- invalid schema/version
- missing required domain record after retention window
- ownership mismatch
- blocked/unsupported merchant
- unsafe redirect or private-network target
- rejected media format
- provider authentication/configuration error requiring operator action
- permanent state transition conflict

### Conditional

- provider `404` may be terminal for deleted assets but retriable briefly after asynchronous creation
- malformed merchant data completes the import as `needsManualEntry` rather than repeatedly failing
- notification token failure revokes the installation instead of retrying indefinitely

## 5. Retry and execution policy

| Job class                |     Initial timeout |            Attempts | Backoff              | Concurrency concern  |
| ------------------------ | ------------------: | ------------------: | -------------------- | -------------------- |
| Small projection/cache   |          30 seconds |                   5 | Exponential + jitter | Entity key           |
| Product import           |          60 seconds |                   5 | Exponential + jitter | Merchant/domain      |
| Image finalize           |          60 seconds |                   5 | Exponential + jitter | Asset ID             |
| Video webhook processing |          30 seconds |                   8 | Exponential + jitter | Provider event/asset |
| Link health              |          30 seconds |                   4 | Exponential + jitter | Domain/link          |
| Code verification        |          60 seconds |                   4 | Configurable         | Merchant/code        |
| Analytics aggregation    |          10 minutes |                   5 | Exponential          | Date partition       |
| Trending computation     |           5 minutes |                   4 | Exponential          | Window               |
| Notification delivery    |          30 seconds |                   6 | Provider-aware       | User/channel         |
| Account export/deletion  |          15 minutes |                   8 | Long exponential     | User ID              |
| Backfill                 | Dedicated job limit | Operator-controlled | Checkpointed         | Partition/range      |

These are starting policies and remain infrastructure configuration, not domain constants. Every handler also enforces its own dependency timeouts below the overall job timeout.

## 6. Job registry

### Catalog and imports

| Job type                              | Producer            | Idempotency scope          | Outcome                               |
| ------------------------------------- | ------------------- | -------------------------- | ------------------------------------- |
| `catalog.product-import.requested.v1` | Creator import API  | Import attempt ID          | Editable product/offer candidate      |
| `catalog.product-image.ingest.v1`     | Import worker/admin | Import + source image hash | Controlled media asset                |
| `catalog.offer.refresh.v1`            | Scheduler/staff     | Offer + refresh window     | Updated freshness/availability        |
| `catalog.product.merge.v1`            | Admin command       | Merge operation ID         | References moved to canonical product |

Product importing is isolated from privileged networks and follows the URL-validation controls in the security document.

### Media

| Job type                            | Producer              | Idempotency scope              | Outcome                        |
| ----------------------------------- | --------------------- | ------------------------------ | ------------------------------ |
| `media.image.finalize.v1`           | Upload completion API | Media asset ID + checksum      | Validated image and renditions |
| `media.video.event-received.v1`     | Mux webhook inbox     | Provider event ID              | Updated video processing state |
| `media.asset.moderate.v1`           | Media ready event     | Asset + moderation policy      | Approved/rejected/queued state |
| `media.asset.delete.v1`             | Deletion workflow     | Media asset + deletion version | Provider and storage cleanup   |
| `media.abandoned-upload.cleanup.v1` | Scheduler             | Time window                    | Expired pending upload cleanup |

### Discovery and caching

| Job type                          | Producer                 | Idempotency scope                | Outcome                        |
| --------------------------------- | ------------------------ | -------------------------------- | ------------------------------ |
| `discovery.projection.refresh.v1` | Domain publication event | Entity + source version          | Updated public card/read model |
| `search.document.upsert.v1`       | Domain publication event | Entity + source version + locale | Updated search document        |
| `search.document.delete.v1`       | Hide/archive event       | Entity + source version          | Removed search document        |
| `web.cache.invalidate.v1`         | Projection ready event   | Invalidation set + version       | Revalidated public pages/tags  |
| `discovery.trending.compute.v1`   | Scheduler                | Window + checkpoint              | New trending score snapshot    |

Cache invalidation occurs after the public projection is ready, not immediately after the source transaction, preventing the web tier from refetching an old projection.

### Discounts and links

| Job type                         | Producer                | Idempotency scope       | Outcome                          |
| -------------------------------- | ----------------------- | ----------------------- | -------------------------------- |
| `discount.code.expire.v1`        | Scheduler               | Code + expiry           | Hidden/expired code              |
| `discount.code.mark-stale.v1`    | Scheduler               | Code + policy window    | Stale verification state         |
| `discount.code.verify.v1`        | Creator/staff/scheduler | Verification attempt ID | Verification history/status      |
| `affiliate.link.health-check.v1` | Scheduler/staff         | Link + check window     | Health result and possible block |

Generic code verification does not automate checkout unless a merchant-specific, legally approved adapter exists.

### Analytics

| Job type                           | Producer                            | Idempotency scope               | Outcome                       |
| ---------------------------------- | ----------------------------------- | ------------------------------- | ----------------------------- |
| `analytics.events.ingest.v1`       | Client batch/redirect/domain events | Batch or event IDs              | Validated raw events          |
| `analytics.daily.aggregate.v1`     | Scheduler                           | Metric date + aggregate version | Daily entity metrics          |
| `analytics.raw-retention.apply.v1` | Scheduler                           | Retention cutoff                | Deleted/exported partitions   |
| `analytics.partition.ensure.v1`    | Scheduler                           | Future month                    | Ready event partition/indexes |

### Notifications and accounts

| Job type                   | Producer                   | Idempotency scope       | Outcome                          |
| -------------------------- | -------------------------- | ----------------------- | -------------------------------- |
| `notification.dispatch.v1` | Domain notification event  | Notification + channel  | Delivery attempt/result          |
| `account.data-export.v1`   | User request               | Export operation ID     | Expiring encrypted export        |
| `account.delete.v1`        | Scheduled deletion request | User + deletion version | Completed deletion/anonymization |

## 7. Product import state machine

```text
queued
  -> validatingUrl
  -> fetching
  -> extracting
  -> deduplicating
  -> ingestingMedia
  -> ready

Any processing state may become:
  -> needsManualEntry
  -> failed
  -> cancelled
  -> blocked
```

- `ready` contains a candidate, warnings, provenance, and permitted images.
- `needsManualEntry` is a successful terminal outcome when safe extraction was attempted but insufficient.
- `blocked` indicates a security, policy, domain, or merchant restriction.
- Raw HTML is not returned to the client or retained without explicit approved diagnostic policy.

## 8. Media state machine

```text
pendingUpload -> uploaded -> processing -> ready
      |             |           |          |
      v             v           v          v
   expired        failed      failed     deleting -> deleted
                              pendingModeration -> approved|rejected|blocked
```

Provider events can arrive more than once or out of order. State application compares provider event time/sequence and VibesHub state rules before changing the asset.

## 9. Outbox dispatch

- The dispatcher selects available undispatched rows using `FOR UPDATE SKIP LOCKED` in bounded batches.
- It publishes Cloud Tasks with the outbox event ID as task identity when supported.
- Duplicate-task conflict is treated as already dispatched after verification.
- The row is marked dispatched only after successful task creation or verified duplication.
- Undispatched event age, failure count, and oldest topic are monitored.
- Outbox payloads are immutable; correction creates a new event.

## 10. Webhook inbox

1. Read bounded raw request bytes.
2. Verify signature and acceptable timestamp before parsing trusted fields.
3. Calculate payload hash.
4. Insert unique `(provider, providerEventId)` receipt.
5. If duplicate with same hash, acknowledge without creating another job.
6. If duplicate ID has a different hash, reject and alert.
7. Enqueue a versioned processing job.
8. Return provider-expected success promptly.

Unknown event types are recorded with a safe status and monitored; they do not receive privileged generic processing.

## 11. Idempotent handler rules

- Claim `ops.job_executions` by idempotency key before side effects.
- Re-read source state and compare expected version.
- Treat already-achieved target state as success.
- Use provider idempotency keys when available.
- Store external provider references before acknowledging completion.
- Write domain changes and resulting outbox events in one transaction.
- Do not send notifications, delete assets, or merge products solely because a task was delivered.

## 12. Scheduling baseline

| Schedule              | Work                                                            |
| --------------------- | --------------------------------------------------------------- |
| Continuous            | Outbox dispatch, webhooks, imports, media, projection refresh   |
| Every 15 minutes      | Expire due codes; refresh operational alerts                    |
| Hourly                | Incremental analytics aggregates; trending recomputation        |
| Daily                 | Mark stale codes, schedule link checks, clean abandoned uploads |
| Weekly/configurable   | Code verification reminders/checks by merchant policy           |
| Before month boundary | Create and verify next analytics partition                      |
| Retention schedule    | Export/drop eligible raw analytics partitions                   |

Schedules are staggered and sharded to avoid a single burst at the top of an hour.

## 13. Operational visibility

Metrics:

- queue depth and oldest task age by job type
- completion, retry, terminal-failure, and dead-letter counts
- execution duration percentiles
- provider latency and error codes
- outbox undispatched age/count
- webhook verification/duplicate counts
- imports by merchant and terminal outcome
- media processing age
- analytics aggregation checkpoint lag
- account deletion/export age

Alerts focus on user impact and backlog age rather than any single retry.

## 14. Manual recovery

The admin/operations surface may:

- inspect redacted job execution state
- retry an allowlisted terminal/retriable job with a new operation ID
- cancel pending import/upload operations
- requeue projection/search rebuilds
- mark provider configuration incidents
- run a scoped reconciliation

It cannot submit arbitrary job types or arbitrary JSON payloads from a browser. Recovery commands construct validated server-side payloads and are audited.

## 15. Compatibility

- Workers support the current and immediately previous job schema versions during rolling deployment.
- Producers switch to a new version only after compatible consumers are deployed.
- Unknown future versions fail terminally and alert rather than being interpreted loosely.
- Long-running account and backfill workflows persist explicit workflow version/checkpoint state.
