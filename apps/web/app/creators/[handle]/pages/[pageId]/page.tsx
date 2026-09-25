import { permanentRedirect } from 'next/navigation';

export default async function LegacyStorefrontPageRoute({
  params,
}: {
  params: Promise<{ handle: string; pageId: string }>;
}) {
  const { handle, pageId } = await params;
  permanentRedirect(`/${encodeURIComponent(handle)}/pages/${encodeURIComponent(pageId)}`);
}
