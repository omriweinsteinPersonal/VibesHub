-- Production reference data is maintained by migrations. Add only disposable
-- local-development fixtures here; never add credentials or personal data.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'noa.levi@example.test',
    '',
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Noa Levi"}',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'maya.cohen@example.test',
    '',
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Maya Cohen"}',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'itay.barak@example.test',
    '',
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Itay Barak"}',
    statement_timestamp(),
    statement_timestamp()
  )
on conflict (id) do nothing;

insert into app.creator_profiles (
  id,
  user_id,
  handle,
  display_name,
  bio_he,
  bio_locale,
  primary_category_id,
  follower_count,
  status,
  is_verified,
  published_at
)
select
  fixture.id,
  fixture.user_id,
  fixture.handle,
  fixture.display_name,
  fixture.bio_he,
  'he',
  category.id,
  fixture.follower_count,
  'approved',
  true,
  statement_timestamp()
from (
  values
    (
      '20000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid,
      'noa-levi',
      'Noa Levi',
      'המלצות אמיתיות על מוצרי טיפוח ואיפור שאני משתמשת בהם ביום יום',
      124000,
      'beauty'
    ),
    (
      '20000000-0000-4000-8000-000000000002'::uuid,
      '10000000-0000-4000-8000-000000000002'::uuid,
      'maya-cohen',
      'Maya Cohen',
      'אופנה נגישה עם עין לפרטים — לוקים שאפשר להרכיב מהארון שכבר יש לך',
      212000,
      'fashion'
    ),
    (
      '20000000-0000-4000-8000-000000000003'::uuid,
      '10000000-0000-4000-8000-000000000003'::uuid,
      'itay-barak',
      'Itay Barak',
      'מינימליזם, עיצוב הבית ופריטים שנשארים איתי שנים',
      88000,
      'lifestyle'
    )
) as fixture(id, user_id, handle, display_name, bio_he, follower_count, category_slug)
join app.categories category on category.slug = fixture.category_slug
on conflict (handle) do update
set
  display_name = excluded.display_name,
  bio_he = excluded.bio_he,
  primary_category_id = excluded.primary_category_id,
  follower_count = excluded.follower_count,
  status = excluded.status,
  is_verified = excluded.is_verified,
  published_at = excluded.published_at;

insert into app.creator_categories (creator_id, category_id, sort_order)
select creator.id, creator.primary_category_id, 0
from app.creator_profiles creator
where creator.id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003'
)
on conflict (creator_id, category_id) do nothing;

insert into app.user_capabilities (user_id, capability)
select fixture.user_id, fixture.capability
from (
  select
    user_id,
    unnest(array[
      'creator:manage_profile',
      'creator:manage_content',
      'creator:view_analytics'
    ]) as capability
  from app.creator_profiles
  where id in (
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003'
  )
) as fixture
on conflict (user_id, capability) do nothing;

insert into app.brands (id, slug, name, normalized_name, status)
values
  (
    '30000000-0000-4000-8000-000000000001',
    'rare-beauty',
    'Rare Beauty',
    'rare beauty',
    'active'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'studio-rina',
    'Studio Rina',
    'studio rina',
    'active'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'norde',
    'Nordé',
    'nordé',
    'active'
  )
on conflict (id) do update
set name = excluded.name, status = excluded.status;

insert into app.merchants (id, slug, name, hostname, homepage_url, status)
values
  (
    '40000000-0000-4000-8000-000000000001',
    'rarebeauty-com',
    'Rare Beauty',
    'rarebeauty.com',
    'https://rarebeauty.com',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'example-com',
    'Local fixture shop',
    'example.com',
    'https://example.com',
    'active'
  )
on conflict (id) do update
set name = excluded.name, homepage_url = excluded.homepage_url, status = excluded.status;

insert into app.products (
  id,
  slug,
  brand_id,
  primary_category_id,
  name,
  normalized_name,
  primary_image_url,
  status
)
select
  fixture.id,
  fixture.slug,
  fixture.brand_id,
  category.id,
  fixture.name,
  fixture.normalized_name,
  fixture.image_url,
  'active'
from (
  values
    (
      '50000000-0000-4000-8000-000000000001'::uuid,
      'rare-beauty-soft-pinch-liquid-blush',
      '30000000-0000-4000-8000-000000000001'::uuid,
      'beauty',
      'Soft Pinch Liquid Blush',
      'soft pinch liquid blush',
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=85'
    ),
    (
      '50000000-0000-4000-8000-000000000002'::uuid,
      'studio-rina-oversized-wool-coat',
      '30000000-0000-4000-8000-000000000002'::uuid,
      'fashion',
      'Oversized Wool Coat',
      'oversized wool coat',
      'https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=1200&q=85'
    ),
    (
      '50000000-0000-4000-8000-000000000003'::uuid,
      'norde-everyday-leather-sneakers',
      '30000000-0000-4000-8000-000000000003'::uuid,
      'lifestyle',
      'Everyday Leather Sneakers',
      'everyday leather sneakers',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85'
    )
) as fixture(id, slug, brand_id, category_slug, name, normalized_name, image_url)
join app.categories category on category.slug = fixture.category_slug
on conflict (id) do update
set
  primary_category_id = excluded.primary_category_id,
  name = excluded.name,
  primary_image_url = excluded.primary_image_url,
  status = excluded.status;

insert into app.product_offers (
  id,
  product_id,
  merchant_id,
  destination_url,
  price_amount_minor,
  currency,
  availability,
  status
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'https://rarebeauty.com/products/soft-pinch-liquid-blush',
    12000,
    'ILS',
    'in_stock',
    'active'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    'https://example.com/products/oversized-wool-coat',
    69000,
    'ILS',
    'in_stock',
    'active'
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000002',
    'https://example.com/products/everyday-leather-sneakers',
    44500,
    'ILS',
    'in_stock',
    'active'
  )
on conflict (id) do update
set
  price_amount_minor = excluded.price_amount_minor,
  availability = excluded.availability,
  status = excluded.status;

insert into app.recommendations (
  id,
  creator_id,
  product_id,
  offer_id,
  image_url,
  review_he,
  video_url,
  discount_code,
  discount_label,
  commercial_relationship,
  lifecycle,
  published_at
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=85',
    'המוצר האהוב עליי למראה טבעי וזוהר — נשאר יפה לאורך כל היום ומשתלב בקלות.',
    'https://videos.pexels.com/video-files/3752531/3752531-hd_1920_1080_25fps.mp4',
    'NOA10',
    '10% off',
    'affiliate',
    'published',
    statement_timestamp()
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000002',
    'https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=1200&q=85',
    'המעיל שמסדר כל לוק בשנייה. קניתי מידה אחת גדולה והוא נראה בדיוק כמו בתצוגות.',
    null,
    'MAYA20',
    '20% off',
    'affiliate',
    'published',
    statement_timestamp()
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000003',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85',
    'נעליים שאני נועל שישה ימים בשבוע — נוחות מהרגע הראשון ונשארות יפות.',
    null,
    null,
    null,
    'organic',
    'published',
    statement_timestamp()
  )
on conflict (id) do update
set
  image_url = excluded.image_url,
  review_he = excluded.review_he,
  video_url = excluded.video_url,
  discount_code = excluded.discount_code,
  discount_label = excluded.discount_label,
  commercial_relationship = excluded.commercial_relationship,
  lifecycle = excluded.lifecycle,
  published_at = excluded.published_at;
