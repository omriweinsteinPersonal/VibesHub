alter table app.discount_codes
  alter column code drop not null,
  add column if not exists creator_brand_id uuid references app.creator_brands(id) on delete set null,
  add column if not exists offer_type text not null default 'creator_code',
  add column if not exists discount_percent integer,
  add column if not exists scope_kind text not null default 'brand',
  add column if not exists scope_id uuid,
  add column if not exists priority integer not null default 0,
  add column if not exists stackable boolean not null default false,
  add column if not exists recurrence_rule text not null default 'none',
  add column if not exists source text not null default 'manual';

alter table app.discount_codes
  add constraint discount_codes_offer_type_check
    check (offer_type in ('creator_code', 'brand_promotion')),
  add constraint discount_codes_percent_check
    check (discount_percent is null or discount_percent between 1 and 100),
  add constraint discount_codes_scope_kind_check
    check (scope_kind in ('brand', 'collection', 'item')),
  add constraint discount_codes_priority_check
    check (priority between -1000 and 1000),
  add constraint discount_codes_recurrence_check
    check (recurrence_rule in ('none', 'month_end_week')),
  add constraint discount_codes_source_check
    check (source in ('manual', 'external')),
  add constraint discount_codes_scope_id_check
    check ((scope_kind = 'brand' and scope_id is null) or (scope_kind <> 'brand' and scope_id is not null));

create index if not exists discount_codes_brand_priority_idx
  on app.discount_codes (creator_id, creator_brand_id, priority desc)
  where deleted_at is null and lifecycle_status = 'published';
