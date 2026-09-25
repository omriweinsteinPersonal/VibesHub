import type { Metadata } from 'next';

import { PublicStorefrontPage } from '../_components/public-storefront-page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  description: 'Authentic product recommendations from an Israeli creator.',
  title: 'Creator storefront',
};

export default async function CreatorStorefrontRoute({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return <PublicStorefrontPage handle={handle} />;
}
