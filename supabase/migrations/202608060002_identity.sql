create table app.users (
  id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version integer not null default 1 check (version > 0)
);

create table app.user_profiles (
  user_id uuid primary key references app.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  avatar_path text,
  locale text not null default 'he-IL',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table app.user_capabilities (
  user_id uuid not null references app.users (id) on delete cascade,
  capability text not null check (
    capability in (
      'shopper:read',
      'shopper:save',
      'creator:manage_profile',
      'creator:manage_content',
      'creator:view_analytics',
      'moderator:review_content',
      'admin:manage_platform'
    )
  ),
  granted_by uuid references app.users (id) on delete set null,
  granted_at timestamptz not null default statement_timestamp(),
  primary key (user_id, capability)
);

create table app.user_consents (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references app.users (id) on delete cascade,
  consent_type text not null,
  document_version text not null,
  accepted_at timestamptz not null default statement_timestamp(),
  ip_hash text,
  unique (user_id, consent_type, document_version)
);

create table app.reserved_handles (
  handle extensions.citext primary key,
  reason text not null,
  created_at timestamptz not null default statement_timestamp(),
  check (handle::text ~ '^[a-z0-9][a-z0-9_-]{1,29}$')
);

create trigger users_set_updated_at
before update on app.users
for each row execute function app.set_updated_at();

create trigger user_profiles_set_updated_at
before update on app.user_profiles
for each row execute function app.set_updated_at();

create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inferred_name text;
begin
  inferred_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'VibesHub shopper'
  );

  insert into app.users (id) values (new.id);
  insert into app.user_profiles (user_id, display_name) values (new.id, inferred_name);
  insert into app.user_capabilities (user_id, capability) values
    (new.id, 'shopper:read'),
    (new.id, 'shopper:save');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function app.handle_new_auth_user();
