insert into app.creator_profiles (
  user_id,
  application_id,
  handle,
  display_name,
  bio_he,
  bio_locale,
  primary_category_id,
  status,
  published_at
)
select
  application.user_id,
  application.id,
  application.requested_handle,
  application.display_name,
  application.bio_text,
  application.bio_locale,
  application.primary_category_id,
  'approved',
  statement_timestamp()
from app.creator_applications application
where application.status in ('submitted', 'under_review')
  and application.requested_handle is not null
  and application.display_name is not null
  and application.bio_text is not null
  and application.primary_category_id is not null
on conflict do nothing;

insert into app.creator_categories (creator_id, category_id, sort_order)
select profile.id, profile.primary_category_id, 0
from app.creator_profiles profile
join app.creator_applications application on application.id = profile.application_id
where application.status in ('submitted', 'under_review')
on conflict do nothing;

insert into app.user_capabilities (user_id, capability, granted_by)
select application.user_id, capability.name, application.user_id
from app.creator_applications application
cross join (
  values
    ('creator:manage_profile'),
    ('creator:manage_content'),
    ('creator:view_analytics')
) as capability(name)
where application.status in ('submitted', 'under_review')
  and exists (
    select 1
    from app.creator_profiles profile
    where profile.application_id = application.id
  )
on conflict do nothing;

update app.creator_applications application
set status = 'approved',
    submitted_at = coalesce(application.submitted_at, statement_timestamp()),
    decided_at = statement_timestamp(),
    version = application.version + 1
where application.status in ('submitted', 'under_review')
  and exists (
    select 1
    from app.creator_profiles profile
    where profile.application_id = application.id
  );
