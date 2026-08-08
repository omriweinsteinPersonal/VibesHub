alter table analytics.events
  drop constraint events_event_name_check;

alter table analytics.events
  add constraint events_event_name_check
  check (
    event_name in (
      'creator.storefrontViewed',
      'recommendation.impression',
      'story.opened',
      'story.completed',
      'discountCode.copied',
      'affiliate.shopClicked'
    )
  );

alter table analytics.creator_daily_metrics
  add column story_opens integer not null default 0 check (story_opens >= 0),
  add column story_completions integer not null default 0 check (story_completions >= 0);

alter table analytics.recommendation_daily_metrics
  add column story_opens integer not null default 0 check (story_opens >= 0),
  add column story_completions integer not null default 0 check (story_completions >= 0);
