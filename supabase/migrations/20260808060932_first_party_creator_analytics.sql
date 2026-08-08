create table analytics.identity_hash_keys (
  id uuid primary key default extensions.gen_random_uuid(),
  key_material bytea not null default extensions.gen_random_bytes(32),
  created_at timestamptz not null default statement_timestamp(),
  retired_at timestamptz,
  check (octet_length(key_material) = 32)
);

create unique index identity_hash_keys_one_active_idx
on analytics.identity_hash_keys ((retired_at is null))
where retired_at is null;

insert into analytics.identity_hash_keys default values;

create table analytics.event_receipts (
  event_id uuid primary key,
  source text not null check (source in ('web', 'ios', 'android', 'server')),
  received_at timestamptz not null default statement_timestamp()
);

create index event_receipts_received_at_idx
on analytics.event_receipts (received_at);

create table analytics.events (
  id uuid not null,
  event_name text not null
    check (
      event_name in (
        'creator.storefrontViewed',
        'recommendation.impression',
        'discountCode.copied',
        'affiliate.shopClicked'
      )
    ),
  schema_version smallint not null default 1 check (schema_version = 1),
  occurred_at timestamptz not null,
  received_at timestamptz not null default statement_timestamp(),
  source text not null check (source in ('web', 'ios', 'android', 'server')),
  authority text not null check (authority in ('client', 'redirect')),
  hash_key_id uuid references analytics.identity_hash_keys (id) on delete restrict,
  anonymous_id_hash text check (
    anonymous_id_hash is null or anonymous_id_hash ~ '^[0-9a-f]{64}$'
  ),
  session_id_hash text check (
    session_id_hash is null or session_id_hash ~ '^[0-9a-f]{64}$'
  ),
  creator_id uuid,
  recommendation_id uuid,
  product_id uuid,
  discount_code_id uuid,
  affiliate_link_id uuid,
  properties jsonb not null default '{}'::jsonb,
  primary key (occurred_at, id),
  check (jsonb_typeof(properties) = 'object'),
  check (
    (authority = 'client' and hash_key_id is not null and session_id_hash is not null)
    or (authority = 'redirect' and source = 'server')
  )
) partition by range (occurred_at);

create table analytics.events_2026_08 partition of analytics.events
for values from ('2026-08-01 00:00:00+00') to ('2026-09-01 00:00:00+00');
create table analytics.events_2026_09 partition of analytics.events
for values from ('2026-09-01 00:00:00+00') to ('2026-10-01 00:00:00+00');
create table analytics.events_2026_10 partition of analytics.events
for values from ('2026-10-01 00:00:00+00') to ('2026-11-01 00:00:00+00');
create table analytics.events_2026_11 partition of analytics.events
for values from ('2026-11-01 00:00:00+00') to ('2026-12-01 00:00:00+00');
create table analytics.events_2026_12 partition of analytics.events
for values from ('2026-12-01 00:00:00+00') to ('2027-01-01 00:00:00+00');
create table analytics.events_2027_01 partition of analytics.events
for values from ('2027-01-01 00:00:00+00') to ('2027-02-01 00:00:00+00');
create table analytics.events_2027_02 partition of analytics.events
for values from ('2027-02-01 00:00:00+00') to ('2027-03-01 00:00:00+00');
create table analytics.events_2027_03 partition of analytics.events
for values from ('2027-03-01 00:00:00+00') to ('2027-04-01 00:00:00+00');
create table analytics.events_2027_04 partition of analytics.events
for values from ('2027-04-01 00:00:00+00') to ('2027-05-01 00:00:00+00');
create table analytics.events_2027_05 partition of analytics.events
for values from ('2027-05-01 00:00:00+00') to ('2027-06-01 00:00:00+00');
create table analytics.events_2027_06 partition of analytics.events
for values from ('2027-06-01 00:00:00+00') to ('2027-07-01 00:00:00+00');
create table analytics.events_2027_07 partition of analytics.events
for values from ('2027-07-01 00:00:00+00') to ('2027-08-01 00:00:00+00');
create table analytics.events_2027_08 partition of analytics.events
for values from ('2027-08-01 00:00:00+00') to ('2027-09-01 00:00:00+00');
create table analytics.events_default partition of analytics.events default;

create index analytics_events_occurred_at_brin
on analytics.events using brin (occurred_at);

create index analytics_events_creator_occurred_idx
on analytics.events (creator_id, occurred_at desc)
where creator_id is not null;

create index analytics_events_recommendation_occurred_idx
on analytics.events (recommendation_id, occurred_at desc)
where recommendation_id is not null;

create index analytics_events_hash_key_idx
on analytics.events (hash_key_id)
where hash_key_id is not null;

create table analytics.creator_daily_visitors (
  creator_id uuid not null references app.creator_profiles (id) on delete cascade,
  metric_date date not null,
  anonymous_id_hash text not null check (anonymous_id_hash ~ '^[0-9a-f]{64}$'),
  first_seen_at timestamptz not null default statement_timestamp(),
  primary key (creator_id, metric_date, anonymous_id_hash)
);

create table analytics.creator_visit_deduplication (
  creator_id uuid not null references app.creator_profiles (id) on delete cascade,
  metric_date date not null,
  session_id_hash text not null check (session_id_hash ~ '^[0-9a-f]{64}$'),
  first_seen_at timestamptz not null default statement_timestamp(),
  primary key (creator_id, metric_date, session_id_hash)
);

create table analytics.recommendation_view_deduplication (
  recommendation_id uuid not null references app.recommendations (id) on delete cascade,
  metric_date date not null,
  session_id_hash text not null check (session_id_hash ~ '^[0-9a-f]{64}$'),
  first_seen_at timestamptz not null default statement_timestamp(),
  primary key (recommendation_id, metric_date, session_id_hash)
);

create table analytics.creator_daily_metrics (
  creator_id uuid not null references app.creator_profiles (id) on delete cascade,
  metric_date date not null,
  storefront_views integer not null default 0 check (storefront_views >= 0),
  unique_visitors integer not null default 0 check (unique_visitors >= 0),
  recommendation_views integer not null default 0 check (recommendation_views >= 0),
  code_copies integer not null default 0 check (code_copies >= 0),
  shop_clicks integer not null default 0 check (shop_clicks >= 0),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (creator_id, metric_date)
);

create table analytics.recommendation_daily_metrics (
  recommendation_id uuid not null references app.recommendations (id) on delete cascade,
  metric_date date not null,
  views integer not null default 0 check (views >= 0),
  code_copies integer not null default 0 check (code_copies >= 0),
  shop_clicks integer not null default 0 check (shop_clicks >= 0),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (recommendation_id, metric_date)
);

create table analytics.link_daily_metrics (
  affiliate_link_id uuid not null references app.affiliate_links (id) on delete cascade,
  metric_date date not null,
  clicks integer not null default 0 check (clicks >= 0),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (affiliate_link_id, metric_date)
);

create table analytics.ingestion_rate_limits (
  identity_hash text not null check (identity_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  event_count integer not null check (event_count between 1 and 120),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (identity_hash, window_started_at)
);

create index ingestion_rate_limits_updated_at_idx
on analytics.ingestion_rate_limits (updated_at);

create trigger creator_daily_metrics_set_updated_at
before update on analytics.creator_daily_metrics
for each row execute function app.set_updated_at();

create trigger recommendation_daily_metrics_set_updated_at
before update on analytics.recommendation_daily_metrics
for each row execute function app.set_updated_at();

create trigger link_daily_metrics_set_updated_at
before update on analytics.link_daily_metrics
for each row execute function app.set_updated_at();

alter table analytics.identity_hash_keys enable row level security;
alter table analytics.event_receipts enable row level security;
alter table analytics.events enable row level security;
alter table analytics.creator_daily_visitors enable row level security;
alter table analytics.creator_visit_deduplication enable row level security;
alter table analytics.recommendation_view_deduplication enable row level security;
alter table analytics.creator_daily_metrics enable row level security;
alter table analytics.recommendation_daily_metrics enable row level security;
alter table analytics.link_daily_metrics enable row level security;
alter table analytics.ingestion_rate_limits enable row level security;

revoke all on all tables in schema analytics from anon, authenticated;
