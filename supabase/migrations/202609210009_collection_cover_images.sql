alter table app.creator_curated_sections
  add column if not exists image_url text null;

alter table app.creator_curated_sections
  add constraint creator_curated_sections_image_url_check
  check (image_url is null or (char_length(image_url) <= 2048 and image_url ~ '^https?://'));
