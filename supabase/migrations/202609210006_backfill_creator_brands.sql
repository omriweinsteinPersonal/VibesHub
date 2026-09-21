insert into app.creator_brands (creator_id, brand_id, website_url, position)
select source.creator_id, source.brand_id, source.website_url,
  coalesce((select max(existing.position) + 1 from app.creator_brands existing where existing.creator_id = source.creator_id), 0)
    + row_number() over (partition by source.creator_id order by source.brand_name)::integer - 1
from (
  select recommendation.creator_id, brand.id as brand_id, brand.name as brand_name,
    coalesce(brand.website_url, regexp_replace(min(affiliate.destination_url), '^(https://[^/]+).*$','\1')) as website_url
  from app.recommendations recommendation
  join app.products product on product.id = recommendation.product_id
  join app.brands brand on brand.id = product.brand_id
  join app.affiliate_links affiliate on affiliate.recommendation_id = recommendation.id
  where recommendation.lifecycle <> 'archived' and recommendation.deleted_at is null
  group by recommendation.creator_id, brand.id, brand.name, brand.website_url
) source
on conflict (creator_id, brand_id) do nothing;
