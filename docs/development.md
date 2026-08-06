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

Local development uses the checked-in Supabase configuration. Preview, staging, and production use separate Supabase and Google Cloud projects. Never connect preview deployments to production data, buckets, queues, OAuth callbacks, or signing keys.

## Database changes

Never edit a migration that has been applied to a shared environment. Create a new migration, run `pnpm db:reset`, and include the migration and regenerated database types in the same pull request. The detailed policy is in `docs/architecture/03-database-migrations.md`.
