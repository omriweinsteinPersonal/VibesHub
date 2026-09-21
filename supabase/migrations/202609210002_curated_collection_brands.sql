alter table app.creator_curated_sections
  add column brand_id uuid null references app.brands (id) on delete restrict;

update app.creator_curated_sections section
set brand_id = (
  select catalog.brand_id
  from app.creator_curated_section_items item
  join app.recommendations recommendation on recommendation.id = item.recommendation_id
  join app.products catalog on catalog.id = recommendation.product_id
  where item.section_id = section.id
  order by item.position
  limit 1
)
where section.kind in ('collection', 'page')
  and section.brand_id is null;

create index creator_curated_sections_brand_idx
  on app.creator_curated_sections (creator_id, brand_id, position);
