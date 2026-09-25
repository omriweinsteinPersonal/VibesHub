import { permanentRedirect } from 'next/navigation';

export default async function LegacyCreatorPreviewRoute({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  permanentRedirect(`/${encodeURIComponent(handle)}`);
}
