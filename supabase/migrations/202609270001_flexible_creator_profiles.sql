alter table app.creator_profiles
  drop constraint if exists creator_profiles_handle_check;

alter table app.creator_profiles
  add constraint creator_profiles_handle_check
  check (
    char_length(handle::text) between 2 and 100
    and handle::text !~ '[/?#%[:cntrl:]]'
    and position(chr(92) in handle::text) = 0
  );

alter table app.creator_applications
  drop constraint if exists creator_applications_handle_format_check;

alter table app.creator_applications
  add constraint creator_applications_handle_format_check
  check (
    requested_handle is null
    or (
      char_length(requested_handle::text) between 2 and 100
      and requested_handle::text !~ '[/?#%[:cntrl:]]'
      and position(chr(92) in requested_handle::text) = 0
    )
  );

alter table app.creator_handle_aliases
  drop constraint if exists creator_handle_aliases_handle_check;

alter table app.creator_handle_aliases
  add constraint creator_handle_aliases_handle_check
  check (
    char_length(handle::text) between 2 and 100
    and handle::text !~ '[/?#%[:cntrl:]]'
    and position(chr(92) in handle::text) = 0
  );
