alter table app.creator_storefront_preferences
  add column if not exists hidden_brand_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(hidden_brand_ids) = 'array'),
  add column if not exists hidden_collection_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(hidden_collection_ids) = 'array'),
  add column if not exists hidden_recommendation_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(hidden_recommendation_ids) = 'array');
