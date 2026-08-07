-- The API is the only database client for these private redirect tables.
create table app.merchant_domains (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references app.merchants (id) on delete cascade,
  hostname extensions.citext not null unique,
  allow_import boolean not null default false,
  allow_redirect boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version integer not null default 1 check (version > 0),
  check (
    hostname::text = lower(hostname::text)
    and char_length(hostname::text) between 4 and 253
    and hostname::text ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'
    and hostname::text like '%.%'
    and hostname::text !~ '(^|\.)\.(\.|$)'
  ),
  check (allow_redirect = false or verified_at is not null),
  unique (id, merchant_id)
);

alter table app.product_offers
  add constraint product_offers_id_merchant_unique unique (id, merchant_id);

create table app.affiliate_links (
  id uuid primary key default extensions.gen_random_uuid(),
  public_id uuid not null default extensions.gen_random_uuid() unique,
  recommendation_id uuid not null
    references app.recommendations (id) on delete restrict,
  offer_id uuid not null references app.product_offers (id) on delete restrict,
  merchant_domain_id uuid not null,
  merchant_id uuid not null references app.merchants (id) on delete restrict,
  destination_url text not null check (destination_url ~ '^https://'),
  destination_url_hash text generated always as (
    encode(extensions.digest(destination_url, 'sha256'), 'hex')
  ) stored,
  provider text check (provider is null or char_length(provider) between 1 and 80),
  provider_reference text
    check (provider_reference is null or char_length(provider_reference) between 1 and 200),
  status text not null default 'blocked'
    check (status in ('active', 'unhealthy', 'blocked', 'archived')),
  last_checked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version integer not null default 1 check (version > 0),
  constraint affiliate_links_offer_merchant_fk
    foreign key (offer_id, merchant_id)
    references app.product_offers (id, merchant_id)
    on delete restrict,
  constraint affiliate_links_domain_merchant_fk
    foreign key (merchant_domain_id, merchant_id)
    references app.merchant_domains (id, merchant_id)
    on delete restrict
);

create unique index affiliate_links_recommendation_current_idx
on app.affiliate_links (recommendation_id)
where status <> 'archived';

create index merchant_domains_merchant_idx
on app.merchant_domains (merchant_id);

create index affiliate_links_recommendation_idx
on app.affiliate_links (recommendation_id);

create index affiliate_links_offer_idx
on app.affiliate_links (offer_id);

create index affiliate_links_merchant_idx
on app.affiliate_links (merchant_id);

create index affiliate_links_domain_idx
on app.affiliate_links (merchant_domain_id);

create index affiliate_links_active_public_idx
on app.affiliate_links (public_id)
include (
  id,
  recommendation_id,
  offer_id,
  merchant_domain_id,
  merchant_id,
  destination_url
)
where status = 'active';

create function app.validate_affiliate_link_destination()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed boolean;
  expected_hostname text;
  actual_hostname text;
begin
  select domain.allow_redirect, lower(domain.hostname::text)
  into allowed, expected_hostname
  from app.merchant_domains domain
  where domain.id = new.merchant_domain_id
    and domain.merchant_id = new.merchant_id;

  actual_hostname := lower(
    substring(new.destination_url from '^https://([^/:?#]+)')
  );

  if expected_hostname is null or actual_hostname is null
    or actual_hostname <> expected_hostname then
    raise exception 'affiliate destination hostname does not match its merchant domain'
      using errcode = '23514';
  end if;

  if new.status = 'active' and allowed is not true then
    raise exception 'affiliate destination domain is not approved for redirects'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger affiliate_links_validate_destination
before insert or update of destination_url, merchant_domain_id, merchant_id, status
on app.affiliate_links
for each row execute function app.validate_affiliate_link_destination();

create function app.block_links_for_disabled_domain()
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
  end if;
  return new;
end;
$$;

create trigger merchant_domains_block_disabled_links
after update of allow_redirect on app.merchant_domains
for each row execute function app.block_links_for_disabled_domain();

create trigger merchant_domains_set_updated_at
before update on app.merchant_domains
for each row execute function app.set_updated_at();

create trigger affiliate_links_set_updated_at
before update on app.affiliate_links
for each row execute function app.set_updated_at();

insert into app.merchant_domains (merchant_id, hostname)
select distinct
  offer.merchant_id,
  lower(substring(offer.destination_url from '^https://([^/:?#]+)'))
from app.product_offers offer
where substring(offer.destination_url from '^https://([^/:?#]+)') is not null
on conflict (hostname) do nothing;

insert into app.affiliate_links (
  recommendation_id,
  offer_id,
  merchant_domain_id,
  merchant_id,
  destination_url,
  status
)
select
  recommendation.id,
  offer.id,
  domain.id,
  offer.merchant_id,
  offer.destination_url,
  'blocked'
from app.recommendations recommendation
join app.product_offers offer on offer.id = recommendation.offer_id
join app.merchant_domains domain
  on domain.merchant_id = offer.merchant_id
 and domain.hostname::text = lower(
   substring(offer.destination_url from '^https://([^/:?#]+)')
 )
where recommendation.deleted_at is null
  and recommendation.lifecycle <> 'archived'
on conflict do nothing;

alter table app.merchant_domains enable row level security;
alter table app.affiliate_links enable row level security;

revoke all on table app.merchant_domains from anon, authenticated;
revoke all on table app.affiliate_links from anon, authenticated;
