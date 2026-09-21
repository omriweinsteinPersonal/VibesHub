create table app.recommendation_categories (
  recommendation_id uuid not null references app.recommendations (id) on delete cascade,
  category_id uuid not null references app.categories (id) on delete restrict,
  position integer not null check (position >= 0),
  created_at timestamptz not null default statement_timestamp(),
  primary key (recommendation_id, category_id),
  unique (recommendation_id, position)
);

insert into app.recommendation_categories (recommendation_id, category_id, position)
select recommendation.id, product.primary_category_id, 0
from app.recommendations recommendation
join app.products product on product.id = recommendation.product_id;

create index recommendation_categories_category_idx
  on app.recommendation_categories (category_id, recommendation_id);

alter table app.recommendation_categories enable row level security;
revoke all on table app.recommendation_categories from anon, authenticated;
