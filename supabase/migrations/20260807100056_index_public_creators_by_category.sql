create index creator_profiles_public_category_directory_idx
on app.creator_profiles (primary_category_id, follower_count desc, id desc)
where status = 'approved' and published_at is not null;
