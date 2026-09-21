alter table app.creator_social_links
  drop constraint if exists creator_social_links_platform_check;

alter table app.creator_social_links
  add constraint creator_social_links_platform_check
  check (platform in (
    'instagram', 'tiktok', 'linkedin', 'x',
    'youtube', 'facebook', 'pinterest', 'website'
  ));

alter table app.creator_application_social_links
  drop constraint if exists creator_application_social_links_platform_check;

alter table app.creator_application_social_links
  add constraint creator_application_social_links_platform_check
  check (platform in (
    'instagram', 'tiktok', 'linkedin', 'x',
    'youtube', 'facebook', 'pinterest', 'website'
  ));
