-- Give every existing creator recommendation a stable, unique storefront position.
-- Published content keeps its current public chronology; drafts follow in creation order;
-- archived content remains last in the creator management view.
with ranked as (
  select
    id,
    row_number() over (
      partition by creator_id
      order by
        case when lifecycle = 'archived' then 1 else 0 end,
        coalesce(published_at, created_at) desc,
        id desc
    )::integer - 1 as next_position
  from app.recommendations
  where deleted_at is null
)
update app.recommendations recommendation
set position = ranked.next_position
from ranked
where ranked.id = recommendation.id;

alter table app.recommendations
  add constraint recommendations_position_nonnegative_check
  check (position >= 0) not valid;

alter table app.recommendations
  validate constraint recommendations_position_nonnegative_check;

drop index if exists app.recommendations_creator_management_idx;
drop index if exists app.recommendations_creator_public_idx;

create index recommendations_creator_management_idx
on app.recommendations (creator_id, position, id)
where deleted_at is null and lifecycle <> 'archived';

create index recommendations_creator_archive_idx
on app.recommendations (creator_id, updated_at desc, id desc)
where deleted_at is null and lifecycle = 'archived';

create index recommendations_creator_public_idx
on app.recommendations (creator_id, position, id)
where deleted_at is null and lifecycle = 'published';

-- These records remain private to the shared API. RLS is retained as defense in depth.
alter table app.recommendations enable row level security;
revoke all on table app.recommendations from anon, authenticated;
