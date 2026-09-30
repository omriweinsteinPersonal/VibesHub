create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inferred_name text;
begin
  inferred_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Swavii creator'
  );

  insert into app.users (id) values (new.id);
  insert into app.user_profiles (user_id, display_name) values (new.id, inferred_name);

  return new;
end;
$$;

comment on schema app is 'Authoritative swavii application data.';

insert into app.reserved_handles (handle, reason)
values ('swavii', 'brand account')
on conflict (handle) do update set reason = excluded.reason;
