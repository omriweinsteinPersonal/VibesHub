create schema if not exists billing;

comment on schema billing is
  'Private, provider-neutral subscription and entitlement state. Server access only.';

create table billing.accounts (
  user_id uuid primary key references app.users(id) on delete cascade,
  external_customer_id uuid not null default extensions.gen_random_uuid() unique,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

comment on column billing.accounts.external_customer_id is
  'Opaque identifier shared with billing providers instead of the Supabase auth user id.';

create table billing.subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references app.users(id) on delete cascade,
  provider text not null,
  store text not null,
  environment text not null,
  provider_subscription_id text not null,
  product_id text not null,
  status text not null,
  current_period_expires_at timestamptz,
  cancel_at_period_end boolean not null default false,
  last_event_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint billing_subscriptions_provider_check
    check (provider in ('revenuecat')),
  constraint billing_subscriptions_store_check
    check (store in ('app_store', 'play_store', 'test_store', 'stripe', 'unknown')),
  constraint billing_subscriptions_environment_check
    check (environment in ('sandbox', 'production')),
  constraint billing_subscriptions_status_check
    check (status in ('active', 'past_due', 'canceled', 'expired', 'revoked')),
  constraint billing_subscriptions_provider_identity_key
    unique (provider, environment, provider_subscription_id)
);

create index billing_subscriptions_user_id_idx
on billing.subscriptions (user_id);

create table billing.entitlements (
  user_id uuid not null references app.users(id) on delete cascade,
  entitlement_key text not null,
  is_active boolean not null default false,
  source_provider text not null,
  source_subscription_id uuid references billing.subscriptions(id) on delete set null,
  active_until timestamptz,
  last_event_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (user_id, entitlement_key),
  constraint billing_entitlements_key_check
    check (entitlement_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint billing_entitlements_source_provider_check
    check (source_provider in ('revenuecat', 'manual'))
);

create index billing_entitlements_source_subscription_id_idx
on billing.entitlements (source_subscription_id);

create table ops.webhook_receipts (
  provider text not null,
  environment text not null,
  provider_event_id text not null,
  payload_hash text not null,
  status text not null default 'received',
  attempt_count integer not null default 1,
  received_at timestamptz not null default statement_timestamp(),
  processed_at timestamptz,
  last_error text,
  primary key (provider, environment, provider_event_id),
  constraint webhook_receipts_provider_check
    check (provider in ('revenuecat')),
  constraint webhook_receipts_environment_check
    check (environment in ('sandbox', 'production')),
  constraint webhook_receipts_status_check
    check (status in ('received', 'processed', 'ignored', 'failed')),
  constraint webhook_receipts_attempt_count_check
    check (attempt_count > 0)
);

create trigger billing_accounts_set_updated_at
before update on billing.accounts
for each row execute function app.set_updated_at();

create trigger billing_subscriptions_set_updated_at
before update on billing.subscriptions
for each row execute function app.set_updated_at();

create trigger billing_entitlements_set_updated_at
before update on billing.entitlements
for each row execute function app.set_updated_at();

alter table billing.accounts enable row level security;
alter table billing.subscriptions enable row level security;
alter table billing.entitlements enable row level security;
alter table ops.webhook_receipts enable row level security;

revoke all on schema billing from public, anon, authenticated;
revoke all on all tables in schema billing from public, anon, authenticated;
revoke all on table ops.webhook_receipts from public, anon, authenticated;
