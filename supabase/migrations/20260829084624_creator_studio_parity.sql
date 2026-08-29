-- Creator-studio parity: richer category taxonomy, configurable storefront rows,
-- private media-kit details, and multiple first-party story clips per product.

insert into app.categories (slug, name_en, description_he, sort_order, is_active)
values
  ('books', 'Books', 'ספרים, קריאה והמלצות תרבות', 70, true),
  ('home-decor', 'Home & Decor', 'עיצוב הבית, ריהוט ופריטי נוי', 80, true),
  ('travel', 'Travel', 'נסיעות, מלונות וחוויות בארץ ובעולם', 90, true),
  ('wellness', 'Wellness', 'בריאות, רוגע ושגרה מאוזנת', 100, true),
  ('accessories-jewelry', 'Accessories & Jewelry', 'תכשיטים ואקססוריז שמשלימים את הלוק', 110, true),
  ('kids-baby', 'Kids & Baby', 'מוצרים שימושיים לילדים ולתינוקות', 120, true),
  ('pets', 'Pets', 'מוצרים מומלצים לחיות מחמד', 130, true),
  ('sports', 'Sports', 'ציוד ספורט, אימונים ופעילות', 140, true),
  ('gaming', 'Gaming', 'גיימינג, משחקים וציוד נלווה', 150, true)
on conflict (slug) do update
set
  name_en = excluded.name_en,
  description_he = excluded.description_he,
  sort_order = excluded.sort_order,
  is_active = true;

create table app.creator_storefront_preferences (
  creator_id uuid primary key
    references app.creator_profiles (id) on delete cascade,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table app.creator_storefront_sections (
  creator_id uuid not null
    references app.creator_profiles (id) on delete cascade,
  category_id uuid not null
    references app.categories (id) on delete restrict,
  position integer not null check (position >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (creator_id, category_id),
  unique (creator_id, position)
);

create index creator_storefront_sections_category_idx
on app.creator_storefront_sections (category_id, creator_id);

create trigger creator_storefront_preferences_set_updated_at
before update on app.creator_storefront_preferences
for each row execute function app.set_updated_at();

create trigger creator_storefront_sections_set_updated_at
before update on app.creator_storefront_sections
for each row execute function app.set_updated_at();

alter table app.creator_storefront_preferences enable row level security;
alter table app.creator_storefront_sections enable row level security;
revoke all on table app.creator_storefront_preferences from anon, authenticated;
revoke all on table app.creator_storefront_sections from anon, authenticated;

create table app.creator_media_kits (
  creator_id uuid primary key
    references app.creator_profiles (id) on delete cascade,
  followers bigint check (followers is null or followers >= 0),
  engagement_rate numeric(5, 2)
    check (engagement_rate is null or engagement_rate between 0 and 100),
  average_story_views bigint
    check (average_story_views is null or average_story_views >= 0),
  average_reel_views bigint
    check (average_reel_views is null or average_reel_views >= 0),
  audience_age_from smallint
    check (audience_age_from is null or audience_age_from between 13 and 100),
  audience_age_to smallint
    check (audience_age_to is null or audience_age_to between 13 and 100),
  rate_per_post_minor integer
    check (rate_per_post_minor is null or rate_per_post_minor >= 0),
  rate_per_story_minor integer
    check (rate_per_story_minor is null or rate_per_story_minor >= 0),
  audience_gender text
    check (audience_gender is null or audience_gender in ('female', 'male', 'mixed', 'not_specified')),
  audience_location text check (audience_location is null or char_length(audience_location) <= 120),
  platforms text[] not null default '{}',
  content_types text[] not null default '{}',
  booking_email extensions.citext,
  agent_agency_name text check (agent_agency_name is null or char_length(agent_agency_name) <= 160),
  agent_email extensions.citext,
  agent_phone text check (agent_phone is null or char_length(agent_phone) <= 40),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (audience_age_to is null or audience_age_from is null or audience_age_to >= audience_age_from),
  check (platforms <@ array['instagram', 'tiktok', 'youtube']::text[]),
  check (content_types <@ array['stories', 'reels', 'posts']::text[])
);

create trigger creator_media_kits_set_updated_at
before update on app.creator_media_kits
for each row execute function app.set_updated_at();

alter table app.creator_media_kits enable row level security;
revoke all on table app.creator_media_kits from anon, authenticated;

alter table app.media_assets
  drop constraint media_assets_bucket_id_check,
  drop constraint media_assets_content_type_check,
  drop constraint media_assets_declared_size_bytes_check,
  drop constraint media_assets_media_kind_check,
  drop constraint media_assets_object_path_check,
  drop constraint media_assets_size_bytes_check;

alter table app.media_assets
  add constraint media_assets_media_kind_check
    check (media_kind in ('recommendation_image', 'story_video')),
  add constraint media_assets_bucket_id_check
    check (
      (media_kind = 'recommendation_image' and bucket_id = 'recommendation-images')
      or (media_kind = 'story_video' and bucket_id = 'story-videos')
    ),
  add constraint media_assets_content_type_check
    check (
      (media_kind = 'recommendation_image' and content_type in ('image/jpeg', 'image/png', 'image/webp'))
      or (media_kind = 'story_video' and content_type in ('video/mp4', 'video/webm', 'video/quicktime'))
    ),
  add constraint media_assets_declared_size_bytes_check
    check (
      declared_size_bytes between 1 and
      case when media_kind = 'story_video' then 52428800 else 5242880 end
    ),
  add constraint media_assets_size_bytes_check
    check (
      size_bytes is null or size_bytes between 1 and
      case when media_kind = 'story_video' then 52428800 else 5242880 end
    ),
  add constraint media_assets_object_path_check
    check (
      object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm|mov)$'
      and object_path !~ '(^|/)\.\.(/|$)'
    );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'story-video-uploads',
    'story-video-uploads',
    false,
    52428800,
    array['video/mp4', 'video/webm', 'video/quicktime']::text[]
  ),
  (
    'story-videos',
    'story-videos',
    true,
    52428800,
    array['video/mp4', 'video/webm', 'video/quicktime']::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table app.recommendation_story_clips (
  id uuid primary key default extensions.gen_random_uuid(),
  recommendation_id uuid not null
    references app.recommendations (id) on delete cascade,
  media_asset_id uuid references app.media_assets (id) on delete restrict,
  video_url text check (video_url is null or video_url ~ '^https://'),
  position integer not null check (position >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (recommendation_id, position),
  check (num_nonnulls(media_asset_id, video_url) = 1)
);

create index recommendation_story_clips_media_asset_idx
on app.recommendation_story_clips (media_asset_id)
where media_asset_id is not null;

create trigger recommendation_story_clips_set_updated_at
before update on app.recommendation_story_clips
for each row execute function app.set_updated_at();

insert into app.recommendation_story_clips (recommendation_id, video_url, position)
select id, video_url, 0
from app.recommendations
where video_url is not null
on conflict (recommendation_id, position) do nothing;

alter table app.recommendation_story_clips enable row level security;
revoke all on table app.recommendation_story_clips from anon, authenticated;
