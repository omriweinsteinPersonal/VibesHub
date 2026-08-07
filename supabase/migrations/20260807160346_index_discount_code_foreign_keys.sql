create index discount_codes_brand_id_idx
  on app.discount_codes (brand_id)
  where brand_id is not null;

create index discount_code_verifications_checked_by_user_id_idx
  on app.discount_code_verifications (checked_by_user_id)
  where checked_by_user_id is not null;
