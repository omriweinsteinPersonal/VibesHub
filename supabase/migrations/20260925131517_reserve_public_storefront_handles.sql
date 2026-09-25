-- Public storefronts live at /<handle>. Reserve every application-owned root route
-- and preserve old handles so links shared on social profiles keep working.

insert into app.reserved_handles (handle, reason)
values
  ('about', 'platform route'),
  ('account', 'platform route'),
  ('admin', 'platform route'),
  ('analytics', 'platform route'),
  ('api', 'platform route'),
  ('app', 'platform route'),
  ('auth', 'platform route'),
  ('creator', 'platform route'),
  ('creator-home', 'platform route'),
  ('creators', 'platform route'),
  ('dashboard', 'platform route'),
  ('discover', 'platform route'),
  ('join', 'platform route'),
  ('login', 'platform route'),
  ('products', 'platform route'),
  ('shoppers', 'platform route'),
  ('support', 'brand account'),
  ('swavii', 'brand account'),
  ('vibeshub', 'legacy brand account'),
  ('www', 'domain route')
on conflict (handle) do update
set reason = excluded.reason;

create table app.creator_handle_aliases (
  handle extensions.citext primary key,
  creator_id uuid not null references app.creator_profiles (id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  check (handle::text ~ '^[a-z0-9][a-z0-9_-]{1,29}$')
);

create index creator_handle_aliases_creator_idx
on app.creator_handle_aliases (creator_id);

alter table app.creator_handle_aliases enable row level security;
revoke all on table app.creator_handle_aliases from anon, authenticated;

create or replace function app.guard_creator_profile_handle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  alias_owner uuid;
begin
  if exists (
    select 1 from app.reserved_handles reserved where reserved.handle = new.handle
  ) then
    raise unique_violation using message = 'Creator handle is reserved';
  end if;

  select alias.creator_id
  into alias_owner
  from app.creator_handle_aliases alias
  where alias.handle = new.handle;

  if alias_owner is not null and alias_owner <> new.id then
    raise unique_violation using message = 'Creator handle belongs to another creator';
  end if;

  if alias_owner = new.id then
    delete from app.creator_handle_aliases alias
    where alias.handle = new.handle and alias.creator_id = new.id;
  end if;

  return new;
end;
$$;

create or replace function app.remember_creator_profile_handle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.handle is distinct from new.handle then
    insert into app.creator_handle_aliases (handle, creator_id)
    values (old.handle, new.id)
    on conflict (handle) do nothing;
  end if;
  return new;
end;
$$;

create trigger creator_profiles_guard_handle
before insert or update of handle on app.creator_profiles
for each row execute function app.guard_creator_profile_handle();

create trigger creator_profiles_remember_handle
after update of handle on app.creator_profiles
for each row execute function app.remember_creator_profile_handle();
