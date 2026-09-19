# ADR-006: Regional deployment topology

**Status:** Accepted

**Date:** 2026-08-06; amended 2026-08-07

## Context

The audience is primarily in Israel. Swave needs global CDN delivery for public assets, managed web deployment, a shared API for web and mobile, separately scalable asynchronous workers, and low-latency access between application compute and the primary PostgreSQL database.

Placing compute near users while leaving the database in another region can make each API request slower because it introduces cross-region latency for every database round trip.

## Decision

- Deploy the Next.js application on Vercel.
- Deploy the NestJS/Fastify API as a separate Vercel project. It remains the shared, independently deployed backend for web and mobile and is not implemented with Next.js Route Handlers.
- Configure the API's Node.js Function compute in Vercel's Frankfurt region (`fra1`).
- Provision Supabase projects in Frankfurt (`eu-central-1`).
- Connect serverless API runtime traffic through the Supavisor transaction pooler on port `6543`, disable prepared statements, require TLS, and bound each warm function instance to a small client pool.
- Keep the worker as a separate application and leave it undeployed until its asynchronous workload and operating budget are explicitly approved. The accepted Google Cloud Run and Cloud Tasks worker target remains deferred rather than active production infrastructure.
- Use Expo EAS for iOS and Android builds and submissions.
- Use separate infrastructure and credentials for development, staging, and production.

## Consequences

- Static and cached web content is served through Vercel's global network.
- The API and web application have separate production URLs, settings, secrets, deployments, and rollback histories even though they share a repository.
- Database-heavy API compute remains geographically close to PostgreSQL.
- Israeli users access dynamic data from Frankfurt rather than a Tel Aviv database region.
- NestJS is packaged as one Vercel Function and is subject to function cold starts, duration, bundle, concurrency, and commercial-plan limits.
- Function scale-out can create many database clients, so connection limits and Supavisor usage must be monitored. The API cannot use session-scoped database features or prepared statements.
- Durable work, scheduling, retries, and long-running processing cannot rely on request execution or function memory and remain worker responsibilities.
- Production secrets are scoped only to the API project's Production environment. Preview deployments do not receive production Supabase credentials before a staging project exists.
- Commercial operation must use a Vercel plan that permits commercial workloads and needs usage alerts and spend controls.
- Provider-specific deployment configuration is isolated from domain code.

## Rejected alternatives

### Put the shared API in Next.js Route Handlers

Rejected because mobile, workers, webhooks, and operational tooling require a backend lifecycle and contract independent of the Next.js application.

### Deploy the worker with the API function

Rejected because product importing, scheduled validation, media processing, analytics aggregation, and retryable delivery need an independently scaled and operated asynchronous runtime. The worker remains undeployed for now.

### Use the Supavisor session pooler for the Vercel API

Rejected because session mode holds a database connection for the client lifetime. Transaction mode is designed for temporary serverless clients and protects the database from function scale-out.

### Wait for Google Cloud billing before deploying the API

Rejected because it leaves the completed identity and account flows unusable even though the current synchronous API workload fits Vercel Functions. Cloud Run remains a future alternative if measured limits justify it.

### Deploy API in Tel Aviv and database in Frankfurt

Rejected because the application would pay cross-region latency on database operations.

### Kubernetes

Rejected because Swave does not initially need cluster operations, custom scheduling, or that level of infrastructure control.

## Revisit when

- Real-user monitoring shows unacceptable Israeli API latency,
- cold starts, function duration, bundle size, or cost materially harm the product,
- Supavisor client pressure or database latency cannot be controlled with the bounded API pool,
- the API gains workloads that require persistent processes or infrastructure unavailable to Vercel Functions,
- The primary database can move to an appropriate Israeli region,
- Data-residency requirements change, or
- Provider availability or cost warrants consolidation.
