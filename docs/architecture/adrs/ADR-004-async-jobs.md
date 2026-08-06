# ADR-004: Asynchronous jobs and integration boundaries

**Status:** Accepted

**Date:** 2026-08-06

## Context

Product importing, image ingestion, video processing, search updates, code expiry, link validation, analytics aggregation, notifications, and account deletion are slow, externally dependent, scheduled, or retryable workloads.

Executing them synchronously inside shopper or creator requests would increase latency and turn vendor failures into user-facing failures.

## Decision

- Use Google Cloud Tasks to deliver durable work to the Cloud Run worker.
- Define jobs through a VibesHub-owned dispatcher interface so domain modules do not depend directly on the queue SDK.
- Version every job payload.
- Use idempotency keys and persisted job-attempt state for externally visible effects.
- Use bounded exponential retries and explicit terminal failure handling.
- Process high-volume analytics through asynchronous ingestion and aggregation.
- Treat vendor webhooks as inputs that are validated, persisted, acknowledged quickly, and processed idempotently.

## Consequences

- User-facing requests remain responsive.
- API and worker capacity scale independently.
- Eventual consistency is visible in states such as importing, processing, indexing, and deleting.
- UI must represent pending and failed states rather than assuming immediate completion.
- Operations require queue depth, failure, retry, age, and dead-letter monitoring.

## Rejected alternatives

### Perform work during HTTP requests

Rejected for any operation that depends on arbitrary merchant latency, media processing, bulk aggregation, or multiple retries.

### Introduce Kafka immediately

Rejected because the first release needs reliable task delivery, not a large distributed streaming platform.

### Database polling as the only queue

Rejected as the primary mechanism because delivery, backoff, concurrency control, and operational visibility should not compete with transactional database work.

## Revisit when

- Event throughput requires a streaming platform,
- Multiple consumers require independent replayable subscriptions, or
- Workflow orchestration becomes complex enough to justify a dedicated workflow engine.
