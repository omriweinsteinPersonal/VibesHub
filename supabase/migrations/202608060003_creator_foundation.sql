create table app.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  name_en text not null,
  description_he text,
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table app.creator_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references app.users (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'withdrawn')),
  legal_name text,
  requested_handle extensions.citext,
  primary_category_id uuid references app.categories (id) on delete set null,
  instagram_url text,
  audience_size integer check (audience_size is null or audience_size >= 0),
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (user_id)
);

create table app.creator_application_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  application_id uuid not null references app.creator_applications (id) on delete cascade,
  reviewer_user_id uuid not null references app.users (id) on delete restrict,
  decision text not null check (decision in ('request_changes', 'approve', 'reject')),
  notes text,
  created_at timestamptz not null default statement_timestamp()
);

create table app.creator_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null unique references app.users (id) on delete cascade,
  application_id uuid unique references app.creator_applications (id) on delete set null,
  handle extensions.citext not null unique,
  display_name text not null check (char_length(display_name) between 1 and 100),
  bio_he text not null default '',
  primary_category_id uuid references app.categories (id) on delete set null,
  follower_count integer not null default 0 check (follower_count >= 0),
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected', 'suspended')),
  is_verified boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version integer not null default 1 check (version > 0),
  check (handle::text ~ '^[a-z0-9][a-z0-9_-]{1,29}$')
);

create table app.creator_categories (
  creator_id uuid not null references app.creator_profiles (id) on delete cascade,
  category_id uuid not null references app.categories (id) on delete restrict,
  sort_order integer not null default 0,
  primary key (creator_id, category_id)
);

create table app.creator_social_links (
  id uuid primary key default extensions.gen_random_uuid(),
  creator_id uuid not null references app.creator_profiles (id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'website')),
  url text not null,
  handle text,
  sort_order integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  unique (creator_id, platform, url)
);

create table app.creator_verifications (
  id uuid primary key default extensions.gen_random_uuid(),
  creator_id uuid not null references app.creator_profiles (id) on delete cascade,
  verification_type text not null,
  status text not null check (status in ('pending', 'verified', 'failed', 'expired')),
  verified_by uuid references app.users (id) on delete set null,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);

create index creator_profiles_discovery_idx
on app.creator_profiles (status, is_verified, follower_count desc);

create index creator_applications_status_idx
on app.creator_applications (status, submitted_at) where status = 'submitted';

create trigger categories_set_updated_at
before update on app.categories
for each row execute function app.set_updated_at();

create trigger creator_applications_set_updated_at
before update on app.creator_applications
for each row execute function app.set_updated_at();

create trigger creator_profiles_set_updated_at
before update on app.creator_profiles
for each row execute function app.set_updated_at();
