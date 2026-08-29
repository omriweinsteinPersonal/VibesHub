alter table analytics.events
  drop constraint events_event_name_check;

alter table analytics.events
  add constraint events_event_name_check
  check (
    event_name in (
      'creator.storefrontViewed',
      'creator.instagramTapped',
      'recommendation.impression',
      'story.opened',
      'story.completed',
      'discountCode.copied',
      'affiliate.shopClicked'
    )
  );

alter table analytics.creator_daily_metrics
  add column instagram_taps integer not null default 0
  check (instagram_taps >= 0);
