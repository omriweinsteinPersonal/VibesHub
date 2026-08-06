# ADR-007: Replaceable search and analytics read models

**Status:** Accepted

**Date:** 2026-08-06

## Context

VibesHub needs bilingual creator, product, brand, and category discovery plus creator-facing traffic metrics and trending feeds. Search indexes and analytics aggregates are derived data, while PostgreSQL records remain authoritative.

Selecting specialized vendors before usage patterns are measured would increase cost and coupling. Treating transactional tables as permanent high-volume analytics storage would eventually degrade operational workloads.

## Decision

- Start discovery with PostgreSQL full-text search and trigram matching.
- Normalize Hebrew and English search fields explicitly.
- Expose search through VibesHub API contracts rather than a vendor SDK in clients.
- Record versioned business events asynchronously.
- Build daily creator, recommendation, and link aggregates for dashboards.
- Compute trending from aggregate signals and recency decay, with editorial controls.
- Keep raw-event retention bounded in PostgreSQL and define an export path to a columnar analytics store.
- Introduce Algolia only when search requirements are measured and PostgreSQL no longer satisfies them.
- Introduce BigQuery, ClickHouse, or another analytical store when raw event volume or reporting complexity justifies it.

## Consequences

- Initial infrastructure remains simpler and less expensive.
- Search and analytics implementations can change behind stable APIs.
- Hebrew search quality must be tested with real queries rather than assumed.
- Aggregate updates are eventually consistent.
- The platform must monitor database write volume and retention before raw events become an operational risk.

## Rejected alternatives

### Algolia from the first development milestone

Deferred because the early catalog and real search behavior are unknown. The API boundary preserves a straightforward later integration.

### Query raw events for every creator dashboard request

Rejected because dashboard latency and database cost would grow with event history.

### Use product analytics events as the only creator attribution source

Rejected because creator-visible business metrics require stable event definitions, ownership, deduplication, and retention independent of a generic UI analytics tool.

## Revisit when

- Search relevance or latency misses accepted targets,
- Faceting and merchandising requirements become operationally important,
- Raw event volume threatens PostgreSQL performance, or
- Cross-source conversion reporting requires a dedicated analytical warehouse.
