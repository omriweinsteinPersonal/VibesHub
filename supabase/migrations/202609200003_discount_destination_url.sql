alter table app.discount_codes
add column destination_url text;

update app.discount_codes code
set destination_url = merchant.homepage_url
from app.merchants merchant
where merchant.id = code.merchant_id;
