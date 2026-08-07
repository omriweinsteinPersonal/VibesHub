create extension if not exists pg_trgm with schema extensions;

-- Substring search powers the global search modal and both public directories.
-- Keep these indexes partial so draft/hidden catalog data does not inflate them.
create index creator_profiles_public_display_name_trgm_idx
on app.creator_profiles using gin (display_name extensions.gin_trgm_ops)
where status = 'approved' and published_at is not null;

create index creator_profiles_public_handle_trgm_idx
on app.creator_profiles using gin ((handle::text) extensions.gin_trgm_ops)
where status = 'approved' and published_at is not null;

create index products_active_name_trgm_idx
on app.products using gin (name extensions.gin_trgm_ops)
where status = 'active';

create index brands_active_name_trgm_idx
on app.brands using gin (name extensions.gin_trgm_ops)
where status = 'active';

-- Newest discovery and choosing one current recommendation per product both
-- use the same stable published-at/id keyset.
create index recommendations_public_newest_idx
on app.recommendations (published_at desc, id desc)
where lifecycle = 'published' and deleted_at is null;

create index recommendations_product_public_newest_idx
on app.recommendations (product_id, published_at desc, id desc)
where lifecycle = 'published' and deleted_at is null;
