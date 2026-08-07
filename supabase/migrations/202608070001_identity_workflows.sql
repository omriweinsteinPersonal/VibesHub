alter table app.user_profiles
  add column if not exists interface_locale text not null default 'en',
  add column if not exists timezone text not null default 'Asia/Jerusalem',
  add column if not exists version integer not null default 1 check (version > 0);

alter table app.creator_applications
  drop constraint if exists creator_applications_status_check;

alter table app.creator_applications
  add column if not exists display_name text,
  add column if not exists bio_text text,
  add column if not exists bio_locale text not null default 'he',
  add column if not exists version integer not null default 1 check (version > 0);

alter table app.creator_applications
  add constraint creator_applications_status_check
  check (
    status in (
      'draft',
      'submitted',
      'under_review',
      'changes_requested',
      'approved',
      'rejected',
      'withdrawn'
    )
  );

alter table app.creator_applications
  add constraint creator_applications_handle_format_check
  check (
    requested_handle is null
    or requested_handle::text ~ '^[a-z0-9][a-z0-9_-]{1,29}$'
  ) not valid;

alter table app.creator_applications
  validate constraint creator_applications_handle_format_check;

create table app.creator_application_social_links (
  id uuid primary key default extensions.gen_random_uuid(),
  application_id uuid not null references app.creator_applications (id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'website')),
  url text not null check (url ~ '^https://'),
  handle text,
  follower_count integer check (follower_count is null or follower_count >= 0),
  position integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (application_id, platform, url)
);

create trigger creator_application_social_links_set_updated_at
before update on app.creator_application_social_links
for each row execute function app.set_updated_at();

alter table app.creator_application_reviews
  drop constraint if exists creator_application_reviews_decision_check;

update app.creator_application_reviews
set decision = case decision
  when 'request_changes' then 'changes_requested'
  when 'approve' then 'approved'
  when 'reject' then 'rejected'
  else decision
end;

alter table app.creator_application_reviews
  add column if not exists public_message text,
  add column if not exists private_notes text,
  add constraint creator_application_reviews_decision_check
  check (decision in ('started', 'changes_requested', 'approved', 'rejected'));

update app.creator_application_reviews
set private_notes = notes
where private_notes is null and notes is not null;

alter table app.creator_profiles
  add column if not exists bio_locale text not null default 'he',
  add column if not exists trust_tier text not null default 'new'
    check (trust_tier in ('new', 'standard', 'trusted', 'restricted'));

create unique index if not exists creator_application_requested_handle_active_idx
on app.creator_applications (requested_handle)
where status in ('submitted', 'under_review', 'changes_requested', 'approved');

create index if not exists creator_application_social_links_application_idx
on app.creator_application_social_links (application_id, position, id);

create index if not exists creator_application_reviews_application_idx
on app.creator_application_reviews (application_id, created_at, id);

alter table app.creator_application_social_links enable row level security;
revoke all on table app.creator_application_social_links from anon, authenticated;
