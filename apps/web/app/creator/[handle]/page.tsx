import type { Metadata } from 'next';

import { CreatorStorefrontEditorPage } from '../../_components/public-storefront-page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  description: 'Design and preview your public storefront.',
  title: 'Storefront editor',
};

export default async function CreatorStorefrontEditorRoute({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return <CreatorStorefrontEditorPage handle={handle} />;
}
