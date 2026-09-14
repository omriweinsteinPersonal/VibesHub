-- Recommendation copy may be written in Hebrew or English. The legacy column
-- name remains for compatibility while the API exposes language-aware text.
alter table app.recommendations
drop constraint if exists recommendations_review_he_check;

-- Bring recommendations already saved through the creator dashboard into the
-- same instant-publish behavior as newly created ones.
update app.merchant_domains merchant_domain
set
  allow_import = true,
  allow_redirect = true,
  verified_at = coalesce(merchant_domain.verified_at, statement_timestamp()),
  review_status = 'approved',
  reviewed_at = coalesce(merchant_domain.reviewed_at, statement_timestamp()),
  review_note = coalesce(
    merchant_domain.review_note,
    'Automatically approved on creator publish'
  )
where exists (
  select 1
  from app.affiliate_links affiliate_link
  join app.recommendations recommendation
    on recommendation.id = affiliate_link.recommendation_id
  join app.creator_profiles creator on creator.id = recommendation.creator_id
  where affiliate_link.merchant_domain_id = merchant_domain.id
    and recommendation.lifecycle <> 'archived'
    and recommendation.deleted_at is null
    and creator.status = 'approved'
);

update app.affiliate_links affiliate_link
set status = 'active', version = affiliate_link.version + 1
from app.recommendations recommendation, app.creator_profiles creator
where recommendation.id = affiliate_link.recommendation_id
  and creator.id = recommendation.creator_id
  and recommendation.lifecycle <> 'archived'
  and recommendation.deleted_at is null
  and creator.status = 'approved'
  and affiliate_link.status = 'blocked';

update app.recommendations recommendation
set
  lifecycle = 'published',
  published_at = statement_timestamp(),
  version = recommendation.version + 1
from app.creator_profiles creator
where creator.id = recommendation.creator_id
  and creator.status = 'approved'
  and recommendation.lifecycle = 'draft'
  and recommendation.deleted_at is null;

with missing_sections as (
  select distinct recommendation.creator_id, product.primary_category_id
  from app.recommendations recommendation
  join app.products product on product.id = recommendation.product_id
  where recommendation.lifecycle = 'published'
    and recommendation.deleted_at is null
),
positioned_sections as (
  select
    missing.creator_id,
    missing.primary_category_id,
    coalesce(existing.maximum_position, -1) +
      row_number() over (
        partition by missing.creator_id
        order by category.sort_order, missing.primary_category_id
      ) as position
  from missing_sections missing
  join app.categories category on category.id = missing.primary_category_id
  left join lateral (
    select max(section.position) as maximum_position
    from app.creator_storefront_sections section
    where section.creator_id = missing.creator_id
  ) existing on true
  where not exists (
    select 1
    from app.creator_storefront_sections section
    where section.creator_id = missing.creator_id
      and section.category_id = missing.primary_category_id
  )
)
insert into app.creator_storefront_sections (creator_id, category_id, position)
select creator_id, primary_category_id, position
from positioned_sections
on conflict (creator_id, category_id) do nothing;
