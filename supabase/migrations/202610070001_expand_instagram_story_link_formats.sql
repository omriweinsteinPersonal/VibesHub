alter table app.recommendations
  drop constraint if exists recommendations_instagram_story_url_check;

alter table app.recommendations
  add constraint recommendations_instagram_story_url_check
  check (
    instagram_story_url is null
    or (
      char_length(instagram_story_url) <= 2048
      and (
        instagram_story_url ~ '^https://(www\.)?instagram\.com/(stories|s|share|highlights)/'
        or instagram_story_url ~ '^https://ig\.me/.+'
      )
    )
  );
