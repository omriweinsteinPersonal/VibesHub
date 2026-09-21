update app.creator_storefront_preferences
set content_order = (content_order #>> '{}')::jsonb
where jsonb_typeof(content_order) = 'string';
