BEGIN;
SELECT plan(10);

SELECT has_schema('billing');
SELECT has_table('billing', 'accounts');
SELECT has_table('billing', 'subscriptions');
SELECT has_table('billing', 'entitlements');
SELECT has_table('ops', 'webhook_receipts');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'billing' AND c.relname = 'accounts'),
  'billing.accounts has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'billing' AND c.relname = 'subscriptions'),
  'billing.subscriptions has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'billing' AND c.relname = 'entitlements'),
  'billing.entitlements has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'ops' AND c.relname = 'webhook_receipts'),
  'ops.webhook_receipts has RLS enabled'
);

SELECT ok(
  NOT has_schema_privilege('anon', 'billing', 'USAGE')
    AND NOT has_schema_privilege('authenticated', 'billing', 'USAGE')
    AND NOT has_table_privilege('anon', 'billing.accounts', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'billing.accounts', 'SELECT')
    AND NOT has_table_privilege('anon', 'billing.subscriptions', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'billing.subscriptions', 'SELECT')
    AND NOT has_table_privilege('anon', 'billing.entitlements', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'billing.entitlements', 'SELECT')
    AND NOT has_table_privilege('anon', 'ops.webhook_receipts', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'ops.webhook_receipts', 'SELECT'),
  'billing state is inaccessible through Supabase client roles'
);

SELECT * FROM finish();
ROLLBACK;
