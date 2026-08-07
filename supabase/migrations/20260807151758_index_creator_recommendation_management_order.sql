drop index if exists app.recommendations_creator_management_idx;
drop index if exists app.recommendations_creator_archive_idx;

create index recommendations_creator_management_idx
on app.recommendations (
  creator_id,
  ((lifecycle = 'archived')::integer),
  position,
  id
)
where deleted_at is null;
