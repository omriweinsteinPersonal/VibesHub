alter table app.creator_storefront_preferences
  add column titles jsonb not null default '[]'::jsonb
  check (jsonb_typeof(titles) = 'array');
