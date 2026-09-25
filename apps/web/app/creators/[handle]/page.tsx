import { permanentRedirect } from 'next/navigation';

export default async function LegacyCreatorStorefrontRoute({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  permanentRedirect(`/${encodeURIComponent(handle)}`);
}
