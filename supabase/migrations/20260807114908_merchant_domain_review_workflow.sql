alter table app.merchant_domains
  add column review_status text not null default 'pending',
  add column reviewed_by_user_id uuid references app.users (id) on delete set null,
  add column reviewed_at timestamptz,
  add column review_note text;

update app.merchant_domains
set
  review_status = case
    when allow_import or allow_redirect then 'approved'
    when verified_at is not null then 'disabled'
    else 'pending'
  end,
  reviewed_at = case
    when allow_import or allow_redirect or verified_at is not null
      then coalesce(verified_at, updated_at)
    else null
  end;

alter table app.merchant_domains
  add constraint merchant_domains_review_status_check
    check (review_status in ('pending', 'approved', 'rejected', 'disabled')),
  add constraint merchant_domains_review_note_check
    check (review_note is null or char_length(review_note) between 1 and 2000),
  add constraint merchant_domains_review_state_check
    check (
      (
        review_status = 'pending'
        and allow_import = false
        and allow_redirect = false
        and verified_at is null
        and reviewed_at is null
        and reviewed_by_user_id is null
        and review_note is null
      )
      or (
        review_status = 'approved'
        and (allow_import or allow_redirect)
        and verified_at is not null
        and reviewed_at is not null
      )
      or (
        review_status = 'rejected'
        and allow_import = false
        and allow_redirect = false
        and verified_at is null
        and reviewed_at is not null
      )
      or (
        review_status = 'disabled'
        and allow_import = false
        and allow_redirect = false
        and reviewed_at is not null
      )
    );

create index merchant_domains_review_queue_idx
on app.merchant_domains (review_status, created_at, id);

create index merchant_domains_reviewer_idx
on app.merchant_domains (reviewed_by_user_id)
where reviewed_by_user_id is not null;

-- Retain the defense-in-depth access boundary for the expanded private record.
alter table app.merchant_domains enable row level security;
revoke all on table app.merchant_domains from anon, authenticated;
