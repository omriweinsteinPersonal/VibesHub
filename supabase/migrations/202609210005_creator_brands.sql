create table app.creator_brands (
  id uuid primary key default extensions.gen_random_uuid(),
  creator_id uuid not null references app.creator_profiles (id) on delete cascade,
  brand_id uuid not null references app.brands (id) on delete restrict,
  website_url text not null check (website_url ~ '^https://'),
  position integer not null check (position >= 0),
  lifecycle text not null default 'active' check (lifecycle in ('active', 'archived')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (creator_id, brand_id),
  unique (creator_id, position)
);

create index creator_brands_creator_idx on app.creator_brands (creator_id, lifecycle, position);
alter table app.creator_brands enable row level security;
revoke all on table app.creator_brands from anon, authenticated;
create trigger creator_brands_set_updated_at before update on app.creator_brands
for each row execute function app.set_updated_at();
