-- Creator-owned recommendations are removed during account deletion.
-- Their tracked affiliate links cannot outlive the recommendation, otherwise the
-- account deletion cascade is blocked.
alter table app.affiliate_links
  drop constraint if exists affiliate_links_recommendation_id_fkey;

alter table app.affiliate_links
  add constraint affiliate_links_recommendation_id_fkey
    foreign key (recommendation_id)
    references app.recommendations(id)
    on delete cascade;
