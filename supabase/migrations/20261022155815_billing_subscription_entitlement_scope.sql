-- Keep subscriptions for different stores/entitlements independent when deriving
-- creator access. Previous billing supported only creator_pro.
alter table billing.subscriptions
  add column entitlement_key text not null default 'creator_pro'
  check (entitlement_key ~ '^[a-z][a-z0-9_]{2,63}$');

create index billing_subscriptions_access_idx
  on billing.subscriptions (user_id, environment, entitlement_key, current_period_expires_at desc);
