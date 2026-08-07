-- Supabase creates this event-trigger function when automatic Data API
-- exposure is disabled. It only needs to run as an event trigger; no API role
-- should be able to invoke it directly.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute
      'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
