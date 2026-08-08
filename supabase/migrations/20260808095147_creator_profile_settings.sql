alter table app.creator_profiles
  add column avatar_media_asset_id uuid
    references app.media_assets (id) on delete set null;

create unique index creator_profiles_avatar_media_asset_unique_idx
on app.creator_profiles (avatar_media_asset_id)
where avatar_media_asset_id is not null;
