alter table app.categories
  add column if not exists created_by_user_id uuid references app.users (id) on delete cascade;

create unique index if not exists categories_creator_name_unique_idx
  on app.categories (created_by_user_id, lower(name_en))
  where created_by_user_id is not null;
