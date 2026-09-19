# ADR-003: Supabase-managed PostgreSQL, Auth, and Storage

**Status:** Accepted

**Date:** 2026-08-06

## Context

Swave data is strongly relational: creators recommend shared products; offers belong to merchants; codes have scopes and states; media has ownership and placement; social actions and moderation require integrity and auditability.

The project also needs authentication, object storage, backups, connection pooling, and a clear path to increased database capacity without operating infrastructure prematurely.

## Decision

- Use a Supabase project in `eu-central-1` for each environment.
- Use its full PostgreSQL database as the system of record.
- Use Supabase Auth for Apple, Google, email magic-link, and session primitives.
- Use Supabase Storage for controlled image uploads and delivery.
- Connect the API using an appropriate pooled PostgreSQL connection.
- Commit all application schema changes as SQL migrations.
- Keep core business logic in the Swave domain/API rather than database-vendor functions.
- Enable row-level security on exposed schemas as defense in depth, even though privileged writes pass through the API.

## Consequences

- The project receives managed PostgreSQL, authentication, storage, backups, and platform tooling.
- PostgreSQL features, indexes, constraints, transactions, and standard migration tools remain available.
- Auth and storage integrations create some provider coupling.
- Project-region selection must be correct early because region changes require migration.
- Production requires paid backup, recovery, access-control, and availability configuration appropriate to launch risk.

## Portability rules

- Do not put core domain behavior exclusively in Supabase Edge Functions.
- Do not expose the service-role key to clients.
- Do not make generated PostgREST endpoints the only contract for core workflows.
- Keep media-provider IDs and auth IDs behind Swave-owned records.
- Test backup restoration and maintain exportable SQL migrations.

## Rejected alternatives

### Firebase as the primary database

Rejected because Swave's relational catalog, ownership, moderation, and reporting model fits PostgreSQL more naturally.

### Self-managed PostgreSQL

Rejected because operating backups, upgrades, pooling, security, and failover is not a product differentiator at this stage.

### Cloud SQL from the first release

Not rejected permanently, but deferred because Supabase provides the required database, auth, and storage primitives with lower initial operational work.

## Revisit when

- Data residency or contractual requirements cannot be met,
- Database scale or availability requirements exceed the selected plan,
- Auth or storage constraints materially block product requirements, or
- The operating team can justify owning more infrastructure.
