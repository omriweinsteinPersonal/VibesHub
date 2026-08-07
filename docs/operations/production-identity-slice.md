# Production identity slice runbook

This runbook deploys the shared NestJS API as its own Vercel project. It does
not deploy the worker, enable Google Cloud billing, or move API routes into the
Next.js application.

## Fixed production topology

| Concern                  | Value                                     |
| ------------------------ | ----------------------------------------- |
| Web project              | `vibes-hub-web`                           |
| Web URL                  | `https://vibes-hub-web.vercel.app`        |
| API project              | `vibeshub-api`                            |
| API root directory       | `apps/api`                                |
| API function region      | `fra1` (Frankfurt)                        |
| Supabase project         | `jelugsfwttolvtrduefo`                    |
| Supabase region          | `eu-central-1` (Frankfurt)                |
| Runtime database route   | Supavisor transaction pooler, port `6543` |
| Production API pool size | `2` client connections per warm instance  |
| Worker                   | Undeployed                                |

## Prerequisites

1. Use a Vercel plan that permits the intended commercial workload.
2. Authenticate the Vercel CLI with an authorized individual account and
   select the existing team explicitly.
3. Obtain the current Supabase database password and service-role key without
   placing either value in source control, terminal history, logs, or chat.
4. Keep Preview free of production Supabase credentials until a staging
   Supabase project exists.

## API runtime preparation

The API's checked-in `vercel.json` pins Function compute to `fra1` and pins the
install command to pnpm `11.20.0`. Vercel detects `apps/api/src/main.ts` as a
NestJS entrypoint and packages the API as one Node.js Function. No rewrite or
Next.js Route Handler is required.

Postgres.js is configured with `prepare: false`; Supavisor transaction mode
cannot retain prepared statements between transactions. Migrations, backups,
and administrative Postgres commands must continue to use Supabase tooling or a
direct administrative connection, never the API runtime URL.

Run the repository gates before deployment:

```bash
npx --yes pnpm@11.20.0 check
npx --yes pnpm@11.20.0 build
```

## Create the separate Vercel project

Import the existing Git repository as a second Vercel project with:

```text
Project name: vibeshub-api
Root directory: apps/api
Framework preset: NestJS
Node.js: 24.x
Include source files outside the root directory: enabled
Production branch: main
Output directory: unset
```

The repository is a pnpm/Turborepo workspace. Vercel must be allowed to include
the shared packages outside `apps/api`; it will use the existing `build` task and
workspace dependency graph. Do not leave the framework preset as `Other`, because
that causes Vercel to look for a static `public` output instead of packaging the
NestJS Function.

## Production environment

Use the transaction-pooler URL shown by Supabase's Connect panel. Its shape is:

```text
postgresql://postgres.jelugsfwttolvtrduefo:<URL_ENCODED_PASSWORD>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

Configure the following for the API project's **Production environment only**:

```text
NODE_ENV=production
LOG_LEVEL=info
DATABASE_POOL_MAX=2
CORS_ORIGINS=https://vibes-hub-web.vercel.app
REDIRECT_BASE_URL=https://YOUR_API_PRODUCTION_DOMAIN
SUPABASE_URL=https://jelugsfwttolvtrduefo.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
DATABASE_URL=YOUR_TRANSACTION_POOLER_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

Mark `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` sensitive and non-readable.
Do not set `PORT`; Vercel supplies it. Do not copy either secret into the web or
mobile project and never prefix it with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.

## API deployment smoke tests

Deploy from `main`, wait for `READY`, and then run:

```bash
curl --fail-with-body https://YOUR_API_PRODUCTION_DOMAIN/health
curl --fail-with-body https://YOUR_API_PRODUCTION_DOMAIN/health/ready
curl --include https://YOUR_API_PRODUCTION_DOMAIN/v1/me
curl --include https://YOUR_API_PRODUCTION_DOMAIN/go/00000000-0000-4000-8000-000000000000
```

The first two requests must return `200`. The unauthenticated `/v1/me` request
must return `401` with `application/problem+json`. The unknown `/go` identifier
must return `404`, `text/html`, and `Cache-Control: no-store` without redirecting.

Also verify:

- an OPTIONS request from `https://vibes-hub-web.vercel.app` receives the exact
  CORS allow origin;
- an unapproved origin receives no CORS authorization;
- repeated readiness requests produce no prepared-statement, connection-limit,
  or TLS errors; and
- Vercel reports no production runtime errors for the API project.

## Web production configuration

After the API is healthy, set these on `vibes-hub-web` Production:

```text
NEXT_PUBLIC_API_URL=https://YOUR_API_PRODUCTION_DOMAIN
NEXT_PUBLIC_SUPABASE_URL=https://jelugsfwttolvtrduefo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Preview must not receive the production API URL or either production Supabase
variable. Redeploy the web project after changing an environment variable.

When native production builds begin, configure the same public API origin as
`EXPO_PUBLIC_API_URL`. This value is an endpoint, not a secret.

## Production acceptance test

- [ ] Email signup creates an account and sends confirmation.
- [ ] Confirmed email login reaches `/account`.
- [ ] Google OAuth login returns to `/account`.
- [ ] Shopper account data loads from the standalone NestJS API.
- [ ] Shopper submits a creator application with Hebrew content.
- [ ] A moderator starts review and requests changes.
- [ ] The applicant sees public feedback and no private notes.
- [ ] A moderator approves the application.
- [ ] Creator capabilities and profile are created transactionally.
- [ ] Missing or invalid tokens receive `401` Problem Details.
- [ ] A shopper receives `403` on moderator endpoints.
- [ ] Browser requests from the production Vercel origin pass CORS.
- [ ] Preview has no production API or Supabase credentials.
- [ ] No worker or Google Cloud resource was deployed.

## Rollback

If API checks fail, do not point the web application at it. If web acceptance
fails after wiring, restore the prior `NEXT_PUBLIC_API_URL` state and redeploy
the previous web production deployment. Vercel can roll the API project back to
its prior production deployment independently.
