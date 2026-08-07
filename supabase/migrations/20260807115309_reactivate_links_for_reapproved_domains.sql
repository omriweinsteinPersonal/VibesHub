create or replace function app.block_links_for_disabled_domain()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.allow_redirect = true and new.allow_redirect = false then
    update app.affiliate_links
    set status = 'blocked', version = version + 1
    where merchant_domain_id = new.id
      and status in ('active', 'unhealthy');
  elsif old.allow_redirect = false and new.allow_redirect = true then
    update app.affiliate_links link
    set status = 'active', version = link.version + 1
    from app.recommendations recommendation,
         app.creator_profiles creator,
         app.product_offers offer,
         app.products product,
         app.merchants merchant
    where link.merchant_domain_id = new.id
      and link.merchant_id = new.merchant_id
      and link.status = 'blocked'
      and recommendation.id = link.recommendation_id
      and recommendation.lifecycle = 'published'
      and recommendation.deleted_at is null
      and creator.id = recommendation.creator_id
      and creator.status = 'approved'
      and creator.published_at is not null
      and offer.id = link.offer_id
      and offer.status = 'active'
      and product.id = recommendation.product_id
      and product.status = 'active'
      and merchant.id = link.merchant_id
      and merchant.status = 'active';
  end if;
  return new;
end;
$$;
