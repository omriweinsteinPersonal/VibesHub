alter table app.creator_storefront_preferences
  add column featured_media jsonb not null default '[]'::jsonb
  check (jsonb_typeof(featured_media) = 'array');
