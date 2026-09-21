alter table app.creator_storefront_preferences
  add column theme jsonb not null default '{"profileBackground":"#fbf6ec","recommendationsBackground":"#ffffff","productBackground":"#ffffff","discountBackground":"#f8f6f2","collectionBackground":"#fbf9f6","accentColor":"#b77856","textColor":"#30251f"}'::jsonb,
  add column theme_version integer not null default 1 check (theme_version > 0);
