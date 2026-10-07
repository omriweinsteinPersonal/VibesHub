create table app.content_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  reporter_installation_id uuid not null,
  target_creator_id uuid references app.creator_profiles (id) on delete cascade,
  target_recommendation_id uuid references app.recommendations (id) on delete cascade,
  target_fingerprint text generated always as (
    case
      when target_creator_id is not null then 'creator:' || target_creator_id::text
      else 'recommendation:' || target_recommendation_id::text
    end
  ) stored,
  reason_code text not null check (
    reason_code in (
      'inappropriate',
      'misleading',
      'spam',
      'unsafe',
      'intellectual_property',
      'other'
    )
  ),
  details text check (details is null or char_length(details) between 1 and 500),
  status text not null default 'received'
    check (status in ('received', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  resolved_at timestamptz,
  check (num_nonnulls(target_creator_id, target_recommendation_id) = 1),
  check ((status in ('resolved', 'dismissed')) = (resolved_at is not null))
);

create unique index content_reports_open_reporter_target_idx
on app.content_reports (reporter_installation_id, target_fingerprint)
where status in ('received', 'reviewing');

create index content_reports_moderation_queue_idx
on app.content_reports (status, created_at, id);

create trigger content_reports_set_updated_at
before update on app.content_reports
for each row execute function app.set_updated_at();

alter table app.content_reports enable row level security;
revoke all on table app.content_reports from anon, authenticated;

comment on table app.content_reports is
  'Anonymous installation-scoped reports of public creator content for staff review.';
