-- Swavii accounts belong to creators and platform operators. Shoppers browse
-- public storefronts without creating a personal account.
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

delete from app.user_capabilities
where capability in ('shopper:read', 'shopper:save');

alter table app.user_capabilities
drop constraint if exists user_capabilities_capability_check;

alter table app.user_capabilities
add constraint user_capabilities_capability_check check (
  capability in (
    'creator:manage_profile',
    'creator:manage_content',
    'creator:view_analytics',
    'moderator:review_content',
    'admin:manage_platform'
  )
);
