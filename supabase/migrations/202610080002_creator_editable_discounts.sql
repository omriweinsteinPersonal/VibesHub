-- Creator discount codes are creator-authored display text. They may be
-- omitted, and when present they may contain spaces or other merchant-defined
-- formatting; only the length limit remains enforced by the API contract.
alter table app.discount_codes
  alter column code drop not null;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'app.discount_codes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%[[:space:]]%'
  loop
    execute format('alter table app.discount_codes drop constraint %I', constraint_name);
  end loop;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'app.recommendations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%[[:space:]]%'
  loop
    execute format('alter table app.recommendations drop constraint %I', constraint_name);
  end loop;
end $$;
