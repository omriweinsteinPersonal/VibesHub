create index brands_created_by_user_idx
on app.brands (created_by_user_id);

create index products_created_by_user_idx
on app.products (created_by_user_id);

create index recommendations_offer_product_idx
on app.recommendations (offer_id, product_id);

drop index app.recommendations_offer_idx;
