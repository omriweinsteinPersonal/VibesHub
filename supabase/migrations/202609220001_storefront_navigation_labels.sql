alter table app.creator_storefront_preferences
  add column if not exists navigation_labels jsonb not null default '[]'::jsonb;

alter table app.creator_storefront_preferences
  add constraint creator_storefront_navigation_labels_array
  check (jsonb_typeof(navigation_labels) = 'array');
