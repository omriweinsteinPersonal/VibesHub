# ADR-006: Regional deployment topology

**Status:** Accepted

**Date:** 2026-08-06

## Context

The audience is primarily in Israel. VibesHub needs global CDN delivery for public assets, managed web deployment, scalable API and worker containers, and low-latency access between application compute and the primary PostgreSQL database.

Placing compute near users while leaving the database in another region can make each API request slower because it introduces cross-region latency for every database round trip.

## Decision

- Deploy the Next.js application on Vercel.
- Configure server compute that accesses application data in Vercel's Frankfurt region (`fra1`).
- Provision Supabase projects in Frankfurt (`eu-central-1`).
- Deploy API and worker containers to Google Cloud Run in Frankfurt (`europe-west3`).
- Use a European Google Cloud Tasks location compatible with the worker deployment.
- Use Expo EAS for iOS and Android builds and submissions.
- Use separate infrastructure and credentials for development, staging, and production.

## Consequences

- Static and cached web content is served through Vercel's global network.
- Database-heavy compute remains geographically close to PostgreSQL.
- Israeli users access dynamic data from Frankfurt rather than a Tel Aviv database region.
- The platform spans multiple managed providers and therefore needs consolidated observability, ownership, billing alerts, and incident procedures.
- Provider-specific deployment configuration is isolated from domain code.

## Rejected alternatives

### Deploy all workloads to Vercel

Rejected as the baseline because product importing, scheduled validation, media webhooks, analytics aggregation, and independent worker scaling benefit from dedicated container workloads.

### Deploy API in Tel Aviv and database in Frankfurt

Rejected because the application would pay cross-region latency on database operations.

### Kubernetes

Rejected because VibesHub does not initially need cluster operations, custom scheduling, or that level of infrastructure control.

## Revisit when

- Real-user monitoring shows unacceptable Israeli API latency,
- The primary database can move to an appropriate Israeli region,
- Data-residency requirements change, or
- Provider availability or cost warrants consolidation.
