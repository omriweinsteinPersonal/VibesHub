# Swave database migration strategy

**Status:** Accepted baseline

**Date:** 2026-08-06

## 1. Objectives

Database changes must be:

- reviewable in Git
- reproducible from an empty database
- rehearsed in staging
- safe for rolling API and worker deployments
- compatible with active web and native client versions
- observable and recoverable
- independent of manual dashboard edits

The migration strategy assumes Supabase-managed PostgreSQL and standard SQL migrations.

## 2. Source of truth

Committed SQL migration files are the only source of truth for the Swave application schema.

```text
packages/database/
  migrations/
    202608060001_extensions_and_schemas.sql
    202608060002_identity.sql
    202608060003_creators.sql
    202608060004_catalog.sql
    202608060005_recommendations.sql
    202608060006_media.sql
    202608060007_social.sql
    202608060008_moderation.sql
    202608060009_analytics.sql
    202608060010_operations.sql
    202608060011_search.sql
    202608060012_grants_and_rls.sql
  seeds/
    reference.sql
    development.sql
  tests/
    constraints/
    permissions/
    migrations/
```

This directory is created during repository scaffolding. The sequence above is a logical starting order, not permission to put the entire schema into one unreviewable migration.

## 3. Migration ownership and permissions

- A dedicated migration owner applies DDL.
- Runtime API, worker, analytics, and read roles never own tables.
- Runtime roles cannot alter schemas, policies, functions, or grants.
- Production migrations run through CI/CD using managed secrets.
- Engineers do not make production schema changes manually in the Supabase dashboard.
- Emergency changes are captured immediately as a committed migration and follow-up review.

## 4. File rules

- Use UTC timestamp prefixes and descriptive snake_case names.
- A migration is immutable after it has run in a shared environment.
- Correct an applied migration with a new forward migration.
- Include comments for non-obvious constraints, indexes, functions, and policies.
- Fully qualify schema names in DDL.
- Set an explicit safe `search_path` inside security-definer functions.
- Do not embed secrets, production IDs, or personal data.
- Separate long-running index or backfill operations when transaction behavior requires it.

## 5. Expand, migrate, contract

Breaking changes use three phases.

### Expand

- Add new nullable columns or tables.
- Add new code paths that can read old and new representations.
- Add indexes without removing old access paths.
- Deploy consumers that understand both schema versions.

### Migrate

- Backfill in small, restartable batches.
- Measure errors, locks, database load, and replication impact.
- Dual-write temporarily when necessary.
- Verify counts, checksums, invariants, and null rates.

### Contract

- Switch all readers to the new representation.
- Stop dual writes.
- Add validated constraints and required nullability.
- Remove obsolete columns, indexes, or tables in a later release.

Native applications make this especially important because old app versions can remain active after a server deployment. HTTP contracts remain backward compatible even when the internal schema evolves.

## 6. Safe column changes

### Adding a required column to a populated table

1. Add the column nullable without a volatile default.
2. Deploy code that writes the new value.
3. Backfill existing rows in bounded batches using a stable key cursor.
4. Add a `CHECK (column IS NOT NULL) NOT VALID` constraint.
5. Validate the constraint separately.
6. Convert to `NOT NULL` when safe.
7. Remove the temporary check if redundant.

### Renaming a column

Do not rename in one deployment.

1. Add the new column.
2. Dual-write old and new columns.
3. Backfill and verify.
4. Switch readers.
5. Stop writing the old column.
6. Remove it in a later contract migration.

### Changing a data type

Use a new column and backfill unless PostgreSQL can prove the change is metadata-only and lock impact has been reviewed.

## 7. Constraints

- Add new foreign keys and check constraints as `NOT VALID` where supported on large populated tables.
- Validate them in a separate operation after existing rows are corrected.
- Use partial unique indexes for active lifecycle uniqueness.
- Prefer text plus check constraints for evolving workflow states over PostgreSQL enum types.
- Test constraint error behavior so the API can map database conflicts to stable domain errors.
- Do not rely only on application validation for identity, money, ownership, or lifecycle invariants that PostgreSQL can enforce locally.

## 8. Indexes

- Create ordinary indexes transactionally only on small or empty tables.
- Use `CREATE INDEX CONCURRENTLY` for populated production tables when lock risk requires it.
- Concurrent index creation runs outside a transaction and therefore uses a dedicated migration step with retry instructions.
- Give every index a descriptive, deterministic name.
- Use partial indexes for public/active rows when most history is archived.
- Inspect `EXPLAIN (ANALYZE, BUFFERS)` in staging with representative data before adding complex indexes.
- Remove unused indexes only after observing production usage across a sufficient period.

## 9. Backfills

Backfills are application jobs, not unbounded DDL statements.

- Read using an indexed stable cursor such as `(created_at, id)` or primary key.
- Update bounded batches.
- Commit between batches.
- Apply rate limits and pause when database health thresholds are exceeded.
- Persist checkpoint state.
- Make each batch idempotent and restartable.
- Record expected, processed, skipped, failed, and remaining counts.
- Verify invariants after completion.

Large backfills run through the worker or a dedicated Cloud Run Job with an explicit runbook.

## 10. Analytics partitioning

`analytics.events` is partitioned monthly by `occurred_at`.

- Create upcoming partitions before the month begins.
- Alert when a suitable future partition is missing.
- Keep a controlled default partition only as a safety net and drain it promptly.
- Apply indexes consistently through partition automation.
- Detach or export expired partitions according to retention policy.
- Daily aggregate tables remain smaller unpartitioned tables until measurements justify otherwise.

Partition management is an operational job with tests, not a manual calendar reminder.

## 11. Seed data

### Reference seed

Version-controlled reference data required in every environment:

- initial categories
- reserved creator handles
- supported locale codes
- stable moderation reason codes
- notification type registry
- analytics event registry

Reference data uses stable IDs where cross-environment identity matters and upserts idempotently.

### Development seed

Synthetic demo data includes:

- realistic fictional Israeli creators
- Hebrew bios and recommendations
- merchants, products, offers, codes, and story metadata
- shopper saves and follows
- moderation and analytics examples

Development seed data never runs automatically in production and contains no copied production user data.

## 12. CI validation

Every database pull request must pass:

1. Create a fresh PostgreSQL/Supabase-compatible test database.
2. Apply all migrations from zero.
3. Apply reference seeds.
4. Run SQL formatting/lint checks.
5. Run constraint tests.
6. Run grants and RLS tests under each runtime role.
7. Run API integration tests against the migrated schema.
8. Verify that generated schema/query types are current.
9. Check for unexpected schema drift.
10. Exercise backup/restore tooling on the scheduled cadence.

A second CI path upgrades a snapshot of the previous schema to the proposed schema, catching problems that a clean install cannot reveal.

## 13. Deployment order

For backward-compatible additive changes:

1. Apply expand migration.
2. Verify migration and database health.
3. Deploy API and worker code compatible with old and new clients.
4. Run any required backfill.
5. Validate data invariants.
6. Enable the new feature behind a server-controlled flag.
7. Observe production behavior.
8. Apply contract migrations only in a later release.

For schema changes needed by cached public pages, revalidation occurs only after the API successfully serves the new projection.

## 14. Transaction and locking rules

- Set explicit statement and lock timeouts for production DDL.
- Avoid table rewrites during peak traffic.
- Do not combine unrelated DDL into one large transaction.
- Review the lock level of every `ALTER TABLE` on populated tables.
- Monitor active sessions, blocked queries, replication, CPU, I/O, connection-pool saturation, and error rates during migration.
- Abort or pause when agreed health thresholds are exceeded.

## 15. Rollback and recovery

The default is forward repair, not automatic destructive down migrations.

- Additive migrations remain in place if an application release is rolled back.
- Application rollback must tolerate the expanded schema.
- Destructive changes require a tested restore or reconstruction plan before execution.
- Take or confirm an appropriate backup/PITR checkpoint before high-risk migrations.
- Document recovery time and data-loss expectations.
- Test restoration into an isolated environment regularly.
- Never claim a rollback is safe merely because a `down.sql` file exists.

## 16. RLS and grant evolution

Permission changes are migrations and receive the same review as tables.

- Start from revoked access and grant only required operations.
- Add table and policy tests for anonymous, authenticated, API, worker, analytics, moderator, and migration roles.
- Validate both allowed and denied cases.
- Use separate policies per operation when it improves reviewability.
- Avoid complex policy functions that silently bypass ownership checks.
- Security-definer functions require an explicit owner, safe search path, limited execute grants, and focused tests.

Storage policies are versioned alongside the database model because uploads are part of the same authorization system.

## 17. Data deletion migrations

Account deletion is a workflow, not a single cascading statement.

1. Mark the account `deletion_pending` and revoke active sessions/capabilities.
2. Stop notifications and new creator publication.
3. Create an export when requested/required.
4. Resolve retention obligations for moderation, security, affiliate, and financial records.
5. Delete or anonymize saves, follows, profile fields, device tokens, private uploads, and analytics identifiers.
6. Archive or remove creator public content according to the published policy.
7. Delete external media/provider assets where required.
8. Remove the auth identity last.
9. Record completion without retaining unnecessary personal data.

Schema migrations must preserve this workflow across releases and never introduce a foreign key that makes compliant deletion impossible without a plan.

## 18. Migration pull-request checklist

- [ ] The change is represented by a new immutable migration.
- [ ] Forward and mixed-version compatibility are documented.
- [ ] Table size and lock behavior were considered.
- [ ] Backfill is bounded, idempotent, observable, and restartable.
- [ ] Constraints and indexes have deterministic names.
- [ ] Grants and RLS changes are included and tested.
- [ ] No secrets or production personal data are present.
- [ ] API/domain errors map expected constraint conflicts.
- [ ] Staging rehearsal and validation queries are documented.
- [ ] Rollback or forward-repair procedure is documented.
- [ ] Public cache/search/analytics projections are updated if necessary.
- [ ] Data retention and account deletion behavior remain valid.

## 19. First migration milestone

The repository-scaffolding step will implement only the foundation needed for the first vertical slice:

1. extensions and private schemas
2. runtime roles and baseline grants
3. `app.users` and `app.user_profiles`
4. categories
5. creator applications and reviews
6. creator profiles and capabilities
7. audit entries
8. outbox and idempotency foundations
9. baseline RLS/grant tests

Catalog, recommendation, media, social, moderation, analytics, and search tables follow in reviewed increments aligned with executable API slices rather than one massive initial migration.
