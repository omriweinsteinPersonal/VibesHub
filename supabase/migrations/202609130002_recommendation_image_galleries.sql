create table app.recommendation_images (
  id uuid primary key default extensions.gen_random_uuid(),
  recommendation_id uuid not null references app.recommendations (id) on delete cascade,
  image_asset_id uuid references app.media_assets (id) on delete restrict,
  image_url text check (image_url is null or image_url ~ '^https://'),
  position integer not null check (position between 0 and 8),
  created_at timestamptz not null default statement_timestamp(),
  check (num_nonnulls(image_asset_id, image_url) = 1),
  unique (recommendation_id, position)
);

create index recommendation_images_asset_idx
on app.recommendation_images (image_asset_id)
where image_asset_id is not null;

alter table app.recommendation_images enable row level security;
revoke all on table app.recommendation_images from anon, authenticated;
