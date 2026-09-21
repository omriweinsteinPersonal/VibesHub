alter table app.creator_brands add column display_name text null
  check (display_name is null or char_length(trim(display_name)) between 1 and 120);
