alter table app.discount_codes
  add column discount_amount_minor integer,
  alter column code drop not null,
  drop constraint if exists discount_codes_details_locale_check;
alter table app.discount_codes
  add constraint discount_codes_details_locale_check check (details_locale in ('en', 'he'));

-- The original Hebrew-only check was unnamed and may receive a generated suffix.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'app.discount_codes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%details_text%'
      and pg_get_constraintdef(oid) like '%א-ת%'
  loop
    execute format('alter table app.discount_codes drop constraint %I', constraint_name);
  end loop;
end $$;

alter table app.discount_codes
  drop constraint if exists discount_codes_discount_amount_minor_check,
  add constraint discount_codes_discount_amount_minor_check
    check (discount_amount_minor is null or discount_amount_minor > 0),
  add constraint discount_codes_single_amount_check
    check (discount_percent is null or discount_amount_minor is null),
  add constraint discount_codes_code_or_label_check
    check (code is not null or label is not null);

alter table app.discount_codes
  drop constraint if exists discount_codes_details_text_check;

alter table app.discount_codes
  add constraint discount_codes_details_text_check
    check (details_text is null or char_length(details_text) between 1 and 1000);

create table app.discount_code_story_clips (
  id uuid not null default extensions.gen_random_uuid(),
  code_id uuid not null references app.discount_codes(id) on delete cascade,
  position integer not null check (position between 0 and 9),
  media_asset_id uuid references app.media_assets(id) on delete restrict,
  video_url text check (video_url is null or video_url ~ '^https://'),
  primary key (id),
  unique (code_id, position),
  check ((media_asset_id is null) <> (video_url is null))
);
create index discount_code_story_clips_media_asset_idx
  on app.discount_code_story_clips(media_asset_id) where media_asset_id is not null;
alter table app.discount_code_story_clips enable row level security;
revoke all on app.discount_code_story_clips from anon, authenticated;

alter table app.media_assets
  drop constraint media_assets_declared_size_bytes_check,
  drop constraint media_assets_size_bytes_check;
alter table app.media_assets
  add constraint media_assets_declared_size_bytes_check
    check (declared_size_bytes > 0 and declared_size_bytes <=
      case when media_kind = 'story_video' then 209715200 else 5242880 end),
  add constraint media_assets_size_bytes_check
    check (size_bytes is null or (size_bytes > 0 and size_bytes <=
      case when media_kind = 'story_video' then 209715200 else 5242880 end));

update storage.buckets set file_size_limit = 209715200
where id in ('story-videos', 'story-video-uploads');
