-- Remove the original deterministic demo marketplace without touching real users.
delete from auth.users
where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003'
);

-- This recommendation was created before automatic category classification.
update app.products product
set primary_category_id = category.id
from app.categories category
where category.slug = 'food'
  and product.name = 'מכונת גריל וכריכים דיגיטלית ANYPRESS MASTER';
