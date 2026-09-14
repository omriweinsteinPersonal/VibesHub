-- Correct the loopback regex for environments where the preceding migration
-- was already applied.
alter table app.media_assets
drop constraint if exists media_assets_public_url_check;

alter table app.media_assets
add constraint media_assets_public_url_check check (
  public_url is null
  or public_url ~ '^https://'
  or public_url ~ '^http://(127[.]0[.]0[.]1|localhost)(:[0-9]+)?/'
);
