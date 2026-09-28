alter table app.recommendations
  add column if not exists content_kind text not null default 'product';

alter table app.recommendations
  drop constraint if exists recommendations_content_kind_check;

alter table app.recommendations
  add constraint recommendations_content_kind_check
  check (content_kind in ('product', 'link'));
