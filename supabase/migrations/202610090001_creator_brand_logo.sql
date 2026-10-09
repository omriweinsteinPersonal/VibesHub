alter table app.creator_brands
  add column logo_media_asset_id uuid references app.media_assets (id) on delete set null,
  add column logo_url text null;

alter table app.creator_brands
  add constraint creator_brands_logo_url_check
  check (logo_url is null or logo_url ~ '^https://');

create index creator_brands_logo_media_asset_idx
  on app.creator_brands (logo_media_asset_id)
  where logo_media_asset_id is not null;
