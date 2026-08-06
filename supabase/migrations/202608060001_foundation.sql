create schema if not exists app;
create schema if not exists analytics;
create schema if not exists audit;
create schema if not exists ops;
create schema if not exists search;

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

comment on schema app is 'Authoritative VibesHub application data.';
comment on schema analytics is 'First-party product analytics and aggregates.';
comment on schema audit is 'Append-only privileged action trail.';
comment on schema ops is 'Operational state, outbox events, and idempotency.';
comment on schema search is 'Derived discovery and search documents.';
