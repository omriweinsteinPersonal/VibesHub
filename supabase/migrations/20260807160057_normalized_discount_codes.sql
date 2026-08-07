create table app.discount_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  creator_id uuid not null references app.creator_profiles (id) on delete cascade,
  merchant_id uuid not null references app.merchants (id) on delete restrict,
  brand_id uuid references app.brands (id) on delete restrict,
  code extensions.citext not null,
  label text check (label is null or char_length(label) between 1 and 100),
  details_text text check (details_text is null or char_length(details_text) between 1 and 1000),
  details_locale text not null default 'he' check (details_locale = 'he'),
  starts_at timestamptz,
  expires_at timestamptz,
  verification_status text not null default 'unverified'
    check (
      verification_status in (
        'unverified',
        'creator_confirmed',
        'staff_confirmed',
        'merchant_verified',
        'failed',
        'stale'
      )
    ),
  last_verified_at timestamptz,
  lifecycle_status text not null default 'draft'
    check (
      lifecycle_status in (
        'draft',
        'submitted',
        'published',
        'hidden',
        'expired',
        'archived'
      )
    ),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0),
  check (char_length(code::text) between 1 and 50),
  check (code::text !~ '[[:space:]]'),
  check (details_text is null or details_text ~ '[א-ת]'),
  check (expires_at is null or starts_at is null or expires_at > starts_at),
  check (
    verification_status = 'unverified'
    or last_verified_at is not null
  )
);

create unique index discount_codes_creator_merchant_code_active_idx
on app.discount_codes (creator_id, merchant_id, code)
where deleted_at is null and lifecycle_status <> 'archived';

create index discount_codes_creator_management_idx
on app.discount_codes (creator_id, lifecycle_status, updated_at desc, id desc)
where deleted_at is null;

create index discount_codes_public_creator_idx
on app.discount_codes (creator_id, expires_at, updated_at desc, id desc)
where deleted_at is null and lifecycle_status = 'published';

create index discount_codes_public_merchant_idx
on app.discount_codes (merchant_id, expires_at)
where deleted_at is null and lifecycle_status = 'published';

create table app.discount_code_products (
  code_id uuid not null references app.discount_codes (id) on delete cascade,
  product_id uuid not null references app.products (id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  primary key (code_id, product_id)
);

create index discount_code_products_product_idx
on app.discount_code_products (product_id, code_id);

create table app.recommendation_discount_codes (
  recommendation_id uuid not null references app.recommendations (id) on delete cascade,
  code_id uuid not null references app.discount_codes (id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default statement_timestamp(),
  primary key (recommendation_id, code_id),
  unique (recommendation_id, position)
);

create index recommendation_discount_codes_code_idx
on app.recommendation_discount_codes (code_id, recommendation_id);

create table app.discount_code_verifications (
  id uuid primary key default extensions.gen_random_uuid(),
  code_id uuid not null references app.discount_codes (id) on delete cascade,
  method text not null
    check (method in ('creator_confirmation', 'staff_confirmation', 'merchant_feed', 'automated_check')),
  result text not null check (result in ('valid', 'invalid', 'inconclusive')),
  checked_by_user_id uuid references app.users (id) on delete set null,
  evidence jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default statement_timestamp(),
  check (jsonb_typeof(evidence) = 'object')
);

create index discount_code_verifications_code_checked_idx
on app.discount_code_verifications (code_id, checked_at desc, id desc);

create trigger discount_codes_set_updated_at
before update on app.discount_codes
for each row execute function app.set_updated_at();

-- Preserve every legacy recommendation code while moving public reads to the
-- normalized model. A published placement is treated as a creator confirmation
-- made at the recommendation's last update time.
with legacy_codes as (
  select distinct on (
    recommendation.creator_id,
    offer.merchant_id,
    lower(recommendation.discount_code)
  )
    recommendation.creator_id,
    offer.merchant_id,
    product.brand_id,
    upper(recommendation.discount_code) as code,
    recommendation.discount_label as label,
    case
      when recommendation.lifecycle = 'published' then 'creator_confirmed'
      else 'unverified'
    end as verification_status,
    case
      when recommendation.lifecycle = 'published' then recommendation.updated_at
      else null
    end as last_verified_at,
    case
      when recommendation.lifecycle = 'published' then 'published'
      else 'draft'
    end as lifecycle_status,
    recommendation.created_at,
    recommendation.updated_at
  from app.recommendations recommendation
  join app.product_offers offer on offer.id = recommendation.offer_id
  join app.products product on product.id = recommendation.product_id
  where recommendation.discount_code is not null
    and recommendation.deleted_at is null
  order by
    recommendation.creator_id,
    offer.merchant_id,
    lower(recommendation.discount_code),
    (recommendation.lifecycle = 'published') desc,
    recommendation.updated_at desc,
    recommendation.id desc
)
insert into app.discount_codes (
  creator_id,
  merchant_id,
  brand_id,
  code,
  label,
  verification_status,
  last_verified_at,
  lifecycle_status,
  created_at,
  updated_at
)
select
  creator_id,
  merchant_id,
  brand_id,
  code,
  label,
  verification_status,
  last_verified_at,
  lifecycle_status,
  created_at,
  updated_at
from legacy_codes;

insert into app.recommendation_discount_codes (recommendation_id, code_id, position)
select recommendation.id, code.id, 0
from app.recommendations recommendation
join app.product_offers offer on offer.id = recommendation.offer_id
join app.discount_codes code
  on code.creator_id = recommendation.creator_id
 and code.merchant_id = offer.merchant_id
 and code.code = recommendation.discount_code
where recommendation.discount_code is not null
  and recommendation.deleted_at is null
on conflict do nothing;

insert into app.discount_code_verifications (
  code_id,
  method,
  result,
  checked_by_user_id,
  evidence,
  checked_at
)
select
  code.id,
  'creator_confirmation',
  'valid',
  creator.user_id,
  jsonb_build_object('source', 'legacy_recommendation_migration'),
  code.last_verified_at
from app.discount_codes code
join app.creator_profiles creator on creator.id = code.creator_id
where code.verification_status = 'creator_confirmed'
  and code.last_verified_at is not null;

alter table app.discount_codes enable row level security;
alter table app.discount_code_products enable row level security;
alter table app.recommendation_discount_codes enable row level security;
alter table app.discount_code_verifications enable row level security;

revoke all on table app.discount_codes from anon, authenticated;
revoke all on table app.discount_code_products from anon, authenticated;
revoke all on table app.recommendation_discount_codes from anon, authenticated;
revoke all on table app.discount_code_verifications from anon, authenticated;
