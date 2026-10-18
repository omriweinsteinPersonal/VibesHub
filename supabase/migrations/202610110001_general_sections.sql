alter table app.creator_curated_sections
  add column if not exists display_style text not null default 'horizontal',
  add column if not exists content_items jsonb not null default '[]'::jsonb;

alter table app.creator_curated_sections
  drop constraint if exists creator_curated_sections_display_style_check;

alter table app.creator_curated_sections
  add constraint creator_curated_sections_display_style_check
  check (display_style in ('horizontal', 'vertical'));
