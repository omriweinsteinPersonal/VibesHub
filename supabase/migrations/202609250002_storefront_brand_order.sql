alter table app.creator_storefront_preferences add column brand_order jsonb not null default '[]'::jsonb check (jsonb_typeof(brand_order) = 'array');
