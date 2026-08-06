insert into app.categories (slug, name_en, description_he, sort_order)
values
  ('fashion', 'Fashion', 'לוקים יומיומיים, מציאות ואאוטפיטים שעובדים', 10),
  ('beauty', 'Beauty', 'איפור, גוונים וכל מה ששווה לנסות', 20),
  ('skincare', 'Skincare', 'רוטינות טיפוח אמיתיות בלי הבטחות מוגזמות', 30),
  ('food', 'Food', 'מתכונים, מסעדות ומוצרים מהמטבח', 40),
  ('fitness', 'Fitness', 'אימונים, ציוד והרגלים שעוזרים להתמיד', 50),
  ('lifestyle', 'Lifestyle', 'עיצוב הבית, טיולים והרגלים קטנים', 60),
  ('technology', 'Technology', 'גאדגטים שבאמת נכנסים לשימוש', 70)
on conflict (slug) do update
set
  name_en = excluded.name_en,
  description_he = excluded.description_he,
  sort_order = excluded.sort_order;

insert into app.reserved_handles (handle, reason)
values
  ('admin', 'platform route'),
  ('api', 'platform route'),
  ('app', 'platform route'),
  ('auth', 'platform route'),
  ('creators', 'platform route'),
  ('dashboard', 'platform route'),
  ('login', 'platform route'),
  ('support', 'brand account'),
  ('vibeshub', 'brand account')
on conflict (handle) do nothing;
