# VibesHub

VibesHub is an English-interface, Hebrew-content creator discovery marketplace for Israeli shoppers. Creators publish storefronts containing product recommendations, story clips, discount codes, and outbound merchant links.

The repository now contains the first runnable platform foundation: a Next.js web application, Expo native application, NestJS/Fastify API and worker, shared TypeScript packages, Supabase migrations, container definitions, and continuous integration.

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- pnpm 11.20.0
- Docker Desktop for the local Supabase stack

## Start locally

```bash
pnpm install
pnpm db:start
pnpm dev
```

The default local services are:

| Service         | URL                            |
| --------------- | ------------------------------ |
| Web             | `http://localhost:3000`        |
| Public API      | `http://localhost:4000`        |
| Worker health   | `http://localhost:4001/health` |
| Supabase API    | `http://127.0.0.1:54321`       |
| Supabase Studio | `http://127.0.0.1:54323`       |

Copy the relevant `.env.example` files to untracked `.env.local` or `.env` files before enabling authenticated or privileged integrations. Service-role credentials must remain server-only.

## Quality gates

```bash
pnpm format:check
pnpm check
pnpm build
```

These same checks run in GitHub Actions on every pull request and push to `main`.

## Repository layout

```text
apps/
  web/       Next.js public web, account, creator studio, and future admin routes
  mobile/    Expo Router application for iOS, Android, and development web previews
  api/       NestJS/Fastify versioned public API
  worker/    Private asynchronous job service
packages/
  analytics/ auth/ config/ contracts/ database/ design-tokens/ domain/ observability/
supabase/
  migrations/ and deterministic seed data
docker/
  production API and worker images
```

## Architecture package

- [Product and business decisions](docs/architecture/00-product-decisions.md)
- [System architecture](docs/architecture/01-system-architecture.md)
- [Data model and ERD](docs/architecture/02-data-model.md)
- [Database migration strategy](docs/architecture/03-database-migrations.md)
- [HTTP API contracts](docs/architecture/04-api-contracts.md)
- [Background jobs](docs/architecture/05-background-jobs.md)
- [Analytics event contracts](docs/architecture/06-analytics-events.md)
- [Security boundaries](docs/architecture/07-security-boundaries.md)
- [Architecture decision records](docs/architecture/adrs/README.md)

## Delivery sequence

1. Lock product and business rules.
2. Record system architecture and technology ADRs.
3. Design the ERD and database migrations.
4. Define API contracts, events, background jobs, and security boundaries.
5. Scaffold the monorepo and local/CI environments. **Complete**
6. Implement identity, creator applications, and moderation. **Complete**
7. Deliver public discovery, creator studio, media, analytics, and native applications in phased releases.
