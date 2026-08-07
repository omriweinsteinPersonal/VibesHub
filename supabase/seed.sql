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
