alter table app.creator_curated_sections
  add column if not exists show_items_individually boolean not null default false;
