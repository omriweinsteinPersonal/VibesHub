-- Keep review history when the reviewer account is deleted.
-- The review remains, but it is no longer linked to a deleted user.
alter table app.creator_application_reviews
  alter column reviewer_user_id drop not null;

alter table app.creator_application_reviews
  drop constraint creator_application_reviews_reviewer_user_id_fkey;

alter table app.creator_application_reviews
  add constraint creator_application_reviews_reviewer_user_id_fkey
    foreign key (reviewer_user_id)
    references app.users(id)
    on delete set null;
