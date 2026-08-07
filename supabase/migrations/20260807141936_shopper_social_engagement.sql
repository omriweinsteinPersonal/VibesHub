create table app.creator_follows (
  user_id uuid not null references app.users (id) on delete cascade,
  creator_id uuid not null references app.creator_profiles (id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  primary key (user_id, creator_id)
);

create table app.saved_products (
  user_id uuid not null references app.users (id) on delete cascade,
  product_id uuid not null references app.products (id) on delete cascade,
  source_recommendation_id uuid references app.recommendations (id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (user_id, product_id)
);

create index creator_follows_user_feed_idx
on app.creator_follows (user_id, created_at desc, creator_id desc);

create index creator_follows_creator_reverse_idx
on app.creator_follows (creator_id, created_at desc, user_id desc);

create index saved_products_user_feed_idx
on app.saved_products (user_id, created_at desc, product_id desc);

create index saved_products_product_reverse_idx
on app.saved_products (product_id, created_at desc, user_id desc);

create index saved_products_source_recommendation_idx
on app.saved_products (source_recommendation_id)
where source_recommendation_id is not null;

alter table app.creator_follows enable row level security;
alter table app.saved_products enable row level security;

revoke all on table app.creator_follows from anon, authenticated;
revoke all on table app.saved_products from anon, authenticated;
