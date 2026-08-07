# Local development

## First setup

1. Install Node.js 24 and pnpm 11.20.0.
2. Run `pnpm install` at the repository root.
3. Install and start Docker Desktop.
4. Run `pnpm db:start` to start the local Supabase stack.
5. Copy each application's `.env.example` only when the integration is needed.
6. Run `pnpm dev` to start the web, mobile, API, worker, and shared package watchers.

Do not commit real credentials. Variables prefixed with `NEXT_PUBLIC_` or `EXPO_PUBLIC_` are bundled into clients and must never contain service-role or signing secrets.

## Common commands

| Command         | Purpose                                                   |
| --------------- | --------------------------------------------------------- |
| `pnpm dev`      | Run development servers and package watchers              |
| `pnpm check`    | Lint, type-check, and run tests                           |
| `pnpm build`    | Build every application and package                       |
| `pnpm format`   | Apply repository formatting                               |
| `pnpm db:reset` | Recreate the local database from migrations and seed data |
| `pnpm db:stop`  | Stop the local Supabase stack                             |

## Environment separation

Local development uses the checked-in Supabase configuration. Preview, staging, and production use separate Supabase and deployment-provider environments. Never connect preview deployments to production data, buckets, queues, OAuth callbacks, or signing keys. Until a staging Supabase project exists, Vercel Preview deployments receive no production Supabase credentials.

## Identity and creator onboarding

The clients authenticate directly with Supabase Auth. Every protected API request sends the Supabase access token as a bearer token; the API verifies its claims and then resolves VibesHub-owned capabilities from PostgreSQL. Supabase metadata is never trusted for creator, moderator, or administrator authorization.

Configure these public client variables from the local Supabase output:

| Surface | Variables                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| Web     | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`                    |
| Mobile  | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_API_URL`                    |
| API     | `DATABASE_URL`, `REDIRECT_BASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

New accounts receive shopper capabilities from the `app.handle_new_auth_user()` database trigger. Creator capabilities are granted only by the transactional approval workflow. For local moderation testing, first create a normal account and then grant the review capability in Supabase Studio's SQL editor:

```sql
insert into app.user_capabilities (user_id, capability)
select id, 'moderator:review_content'
from auth.users
where email = 'moderator@example.com'
on conflict do nothing;
```

This bootstrap is for local development only. Staging and production staff access must be provisioned through an audited operator process.

## Database changes

Never edit a migration that has been applied to a shared environment. Create a new migration, run `pnpm db:reset`, and include the migration and regenerated database types in the same pull request. The detailed policy is in `docs/architecture/03-database-migrations.md`.
