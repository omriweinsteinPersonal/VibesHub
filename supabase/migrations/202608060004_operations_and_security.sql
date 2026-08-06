create table audit.entries (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid references app.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default statement_timestamp()
);

create table ops.idempotency_keys (
  key text not null,
  actor_id uuid,
  operation text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (key, operation)
);

create table ops.outbox_events (
  id uuid primary key default extensions.gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  event_version integer not null default 1 check (event_version > 0),
  payload jsonb not null,
  idempotency_key text not null unique,
  occurred_at timestamptz not null default statement_timestamp(),
  published_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text
);

create index outbox_unpublished_idx
on ops.outbox_events (occurred_at) where published_at is null;

alter table app.users enable row level security;
alter table app.user_profiles enable row level security;
alter table app.user_capabilities enable row level security;
alter table app.user_consents enable row level security;
alter table app.reserved_handles enable row level security;
alter table app.categories enable row level security;
alter table app.creator_applications enable row level security;
alter table app.creator_application_reviews enable row level security;
alter table app.creator_profiles enable row level security;
alter table app.creator_categories enable row level security;
alter table app.creator_social_links enable row level security;
alter table app.creator_verifications enable row level security;
alter table audit.entries enable row level security;
alter table ops.idempotency_keys enable row level security;
alter table ops.outbox_events enable row level security;

revoke all on schema app from anon, authenticated;
revoke all on schema analytics from anon, authenticated;
revoke all on schema audit from anon, authenticated;
revoke all on schema ops from anon, authenticated;
revoke all on schema search from anon, authenticated;

revoke all on all tables in schema app from anon, authenticated;
revoke all on all tables in schema analytics from anon, authenticated;
revoke all on all tables in schema audit from anon, authenticated;
revoke all on all tables in schema ops from anon, authenticated;
revoke all on all tables in schema search from anon, authenticated;
