alter table app.creator_storefront_preferences
add column content_order jsonb not null default '[]'::jsonb;
