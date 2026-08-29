import type { Metadata } from 'next';

import CreatorStorefrontPage from '../../creators/[handle]/page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  description: 'Authentic product recommendations from an approved Israeli creator.',
  title: 'Creator storefront',
};

export default CreatorStorefrontPage;
