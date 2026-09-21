create table app.product_categories (
  product_id uuid not null references app.products (id) on delete cascade,
  category_id uuid not null references app.categories (id) on delete restrict,
  position integer not null check (position >= 0),
  created_at timestamptz not null default statement_timestamp(),
  primary key (product_id, category_id),
  unique (product_id, position)
);

insert into app.product_categories (product_id, category_id, position)
select id, primary_category_id, 0 from app.products;

create index product_categories_category_idx
  on app.product_categories (category_id, product_id);

alter table app.product_categories enable row level security;
revoke all on table app.product_categories from anon, authenticated;
