alter table app.recommendations
  add column instagram_story_url text
  constraint recommendations_instagram_story_url_check
  check (
    instagram_story_url is null
    or (
      char_length(instagram_story_url) <= 2048
      and instagram_story_url ~ '^https://(www\.)?instagram\.com/stories/'
    )
  );
