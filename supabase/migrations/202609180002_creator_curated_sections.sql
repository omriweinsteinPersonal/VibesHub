create table app.creator_curated_sections (
  id uuid primary key default extensions.gen_random_uuid(),
  creator_id uuid not null references app.creator_profiles (id) on delete cascade,
  kind text not null check (kind in ('section', 'collection')),
  title text not null check (char_length(trim(title)) between 1 and 80),
  position integer not null check (position >= 0),
  created_at timestamptz not null default statement_timestamp(),
  unique (creator_id, id),
  unique (creator_id, position)
);

create table app.creator_curated_section_items (
  section_id uuid not null references app.creator_curated_sections (id) on delete cascade,
  recommendation_id uuid not null references app.recommendations (id) on delete cascade,
  position integer not null check (position >= 0),
  primary key (section_id, recommendation_id),
  unique (section_id, position)
);

create index creator_curated_sections_creator_idx
  on app.creator_curated_sections (creator_id, position);

create index creator_curated_section_items_recommendation_idx
  on app.creator_curated_section_items (recommendation_id);

alter table app.creator_curated_sections enable row level security;
alter table app.creator_curated_section_items enable row level security;
revoke all on table app.creator_curated_sections from anon, authenticated;
revoke all on table app.creator_curated_section_items from anon, authenticated;
