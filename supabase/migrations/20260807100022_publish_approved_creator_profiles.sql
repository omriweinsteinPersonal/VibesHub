update app.creator_profiles
set published_at = coalesce(published_at, created_at)
where status = 'approved'
  and published_at is null;

alter table app.creator_profiles
  add constraint creator_profiles_approved_is_published_check
  check (status <> 'approved' or published_at is not null)
  not valid;

alter table app.creator_profiles
  validate constraint creator_profiles_approved_is_published_check;

create index creator_profiles_public_directory_idx
on app.creator_profiles (follower_count desc, id desc)
where status = 'approved' and published_at is not null;
