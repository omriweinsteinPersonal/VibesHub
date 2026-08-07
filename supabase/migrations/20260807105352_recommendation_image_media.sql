create table app.media_assets (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid references app.users (id) on delete set null,
  media_kind text not null default 'recommendation_image'
    check (media_kind = 'recommendation_image'),
  bucket_id text not null default 'recommendation-images'
    check (bucket_id = 'recommendation-images'),
  object_path text not null,
  content_type text not null
    check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  declared_size_bytes bigint not null
    check (declared_size_bytes between 1 and 5242880),
  size_bytes bigint check (size_bytes between 1 and 5242880),
  status text not null default 'pending_upload'
    check (status in ('pending_upload', 'ready', 'failed', 'deleted')),
  upload_expires_at timestamptz not null,
  completed_at timestamptz,
  deleted_at timestamptz,
  public_url text check (public_url is null or public_url ~ '^https://'),
  failure_code text check (
    failure_code is null
    or failure_code in ('missing_object', 'invalid_content', 'size_mismatch')
  ),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version integer not null default 1 check (version > 0),
  unique (bucket_id, object_path),
  check (
    object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and object_path !~ '(^|/)\.\.(/|$)'
  ),
  check (
    (status = 'pending_upload'
      and completed_at is null
      and deleted_at is null
      and public_url is null
      and size_bytes is null
      and failure_code is null)
    or (status = 'ready'
      and completed_at is not null
      and deleted_at is null
      and public_url is not null
      and size_bytes is not null
      and failure_code is null)
    or (status in ('failed', 'deleted')
      and deleted_at is not null
      and public_url is null)
  )
);

alter table app.products
  add column primary_image_asset_id uuid
  references app.media_assets (id) on delete restrict;

alter table app.products
  alter column primary_image_url drop not null;

alter table app.products
  add constraint products_primary_image_source_check
  check (num_nonnulls(primary_image_url, primary_image_asset_id) = 1);

alter table app.recommendations
  add column image_asset_id uuid
  references app.media_assets (id) on delete restrict;

alter table app.recommendations
  alter column image_url drop not null;

alter table app.recommendations
  add constraint recommendations_image_source_check
  check (num_nonnulls(image_url, image_asset_id) = 1);

create index media_assets_owner_management_idx
on app.media_assets (owner_user_id, created_at desc, id desc)
where status <> 'deleted';

create index media_assets_pending_expiry_idx
on app.media_assets (upload_expires_at, id)
where status = 'pending_upload';

create index products_primary_image_asset_idx
on app.products (primary_image_asset_id)
where primary_image_asset_id is not null;

create index recommendations_image_asset_idx
on app.recommendations (image_asset_id)
where image_asset_id is not null;

create trigger media_assets_set_updated_at
before update on app.media_assets
for each row execute function app.set_updated_at();

alter table app.media_assets enable row level security;
revoke all on table app.media_assets from anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'recommendation-images',
  'recommendation-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
