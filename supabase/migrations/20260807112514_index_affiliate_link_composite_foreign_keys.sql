-- Cover both columns of the composite identity constraints used by redirect lookups.
drop index app.affiliate_links_offer_idx;
drop index app.affiliate_links_domain_idx;

create index affiliate_links_offer_merchant_idx
on app.affiliate_links (offer_id, merchant_id);

create index affiliate_links_domain_merchant_idx
on app.affiliate_links (merchant_domain_id, merchant_id);
