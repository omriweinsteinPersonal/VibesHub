alter table app.creator_curated_sections
  add column description text not null default '',
  add column parent_collection_id uuid null;

alter table app.creator_curated_sections
  drop constraint creator_curated_sections_kind_check;

alter table app.creator_curated_sections
  add constraint creator_curated_sections_kind_check
  check (kind in ('section', 'collection', 'page'));

alter table app.creator_curated_sections
  add constraint creator_curated_sections_description_check
  check (char_length(description) <= 240);
