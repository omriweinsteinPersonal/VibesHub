create table app.brands (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  name text not null check (char_length(name) between 1 and 120),
  normalized_name text not null unique check (char_length(normalized_name) between 1 and 120),
  website_url text check (website_url is null or website_url ~ '^https://'),
  status text not null default 'active' check (status in ('active', 'hidden', 'merged')),
  created_by_user_id uuid references app.users (id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version integer not null default 1 check (version > 0),
  check (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table app.merchants (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  name text not null check (char_length(name) between 1 and 160),
  hostname extensions.citext not null unique,
  homepage_url text not null check (homepage_url ~ '^https://'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version integer not null default 1 check (version > 0),
  check (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  check (hostname::text ~ '^[a-z0-9.-]+$')
);

create table app.products (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  brand_id uuid not null references app.brands (id) on delete restrict,
  primary_category_id uuid not null references app.categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 200),
  normalized_name text not null check (char_length(normalized_name) between 1 and 200),
  description text,
  primary_image_url text not null check (primary_image_url ~ '^https://'),
  status text not null default 'active' check (status in ('draft', 'active', 'hidden', 'merged')),
  created_by_user_id uuid references app.users (id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version integer not null default 1 check (version > 0),
  unique (brand_id, normalized_name),
  check (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table app.product_offers (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references app.products (id) on delete restrict,
  merchant_id uuid not null references app.merchants (id) on delete restrict,
  destination_url text not null check (destination_url ~ '^https://'),
  destination_url_hash text generated always as (
    encode(extensions.digest(destination_url, 'sha256'), 'hex')
  ) stored,
  price_amount_minor bigint not null check (price_amount_minor >= 0),
  currency text not null default 'ILS' check (currency = 'ILS'),
  availability text not null default 'unknown'
    check (availability in ('unknown', 'in_stock', 'out_of_stock')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  observed_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version integer not null default 1 check (version > 0),
  unique (destination_url_hash),
  unique (id, product_id)
);

create table app.recommendations (
  id uuid primary key default extensions.gen_random_uuid(),
  creator_id uuid not null references app.creator_profiles (id) on delete cascade,
  product_id uuid not null references app.products (id) on delete restrict,
  offer_id uuid not null,
  image_url text not null check (image_url ~ '^https://'),
  review_he text not null check (
    char_length(review_he) between 1 and 1000
    and review_he ~ '[א-ת]'
  ),
  review_locale text not null default 'he' check (review_locale = 'he'),
  video_url text check (video_url is null or video_url ~ '^https://'),
  discount_code text check (
    discount_code is null
    or char_length(discount_code) between 1 and 50
  ),
  discount_label text check (
    discount_label is null
    or char_length(discount_label) between 1 and 100
  ),
  commercial_relationship text not null default 'organic'
    check (commercial_relationship in ('organic', 'affiliate', 'sponsored', 'gifted')),
  lifecycle text not null default 'draft'
    check (lifecycle in ('draft', 'published', 'archived')),
  moderation_status text not null default 'not_required'
    check (moderation_status in ('not_required', 'pending', 'approved', 'rejected')),
  position integer not null default 0,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version integer not null default 1 check (version > 0),
  constraint recommendations_offer_product_fk
    foreign key (offer_id, product_id)
    references app.product_offers (id, product_id)
    on delete restrict,
  check (
    (lifecycle = 'published' and published_at is not null)
    or (lifecycle <> 'published' and published_at is null)
  ),
  check (discount_code is null or discount_code !~ '[[:space:]]')
);

create unique index recommendations_creator_product_active_idx
on app.recommendations (creator_id, product_id)
where deleted_at is null and lifecycle <> 'archived';

create index products_brand_idx on app.products (brand_id);
create index products_category_idx on app.products (primary_category_id);
create index product_offers_product_idx on app.product_offers (product_id);
create index product_offers_merchant_idx on app.product_offers (merchant_id);
create index recommendations_product_idx on app.recommendations (product_id);
create index recommendations_offer_idx on app.recommendations (offer_id);
create index recommendations_creator_management_idx
on app.recommendations (creator_id, created_at desc, id desc)
where deleted_at is null;
create index recommendations_creator_public_idx
on app.recommendations (creator_id, published_at desc, id desc)
where deleted_at is null and lifecycle = 'published';

create trigger brands_set_updated_at
before update on app.brands
for each row execute function app.set_updated_at();

create trigger merchants_set_updated_at
before update on app.merchants
for each row execute function app.set_updated_at();

create trigger products_set_updated_at
before update on app.products
for each row execute function app.set_updated_at();

create trigger product_offers_set_updated_at
before update on app.product_offers
for each row execute function app.set_updated_at();

create trigger recommendations_set_updated_at
before update on app.recommendations
for each row execute function app.set_updated_at();

alter table app.brands enable row level security;
alter table app.merchants enable row level security;
alter table app.products enable row level security;
alter table app.product_offers enable row level security;
alter table app.recommendations enable row level security;

revoke all on table app.brands from anon, authenticated;
revoke all on table app.merchants from anon, authenticated;
revoke all on table app.products from anon, authenticated;
revoke all on table app.product_offers from anon, authenticated;
revoke all on table app.recommendations from anon, authenticated;
