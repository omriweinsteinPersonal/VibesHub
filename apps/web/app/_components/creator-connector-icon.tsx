import type { CreatorProfileSocialLink } from '@vibeshub/contracts';
import Image from 'next/image';
import { Globe2 } from 'lucide-react';

type SocialPlatform = CreatorProfileSocialLink['platform'];

const iconFiles: Partial<Record<SocialPlatform, string>> = {
  facebook: 'facebook',
  instagram: 'instagram',
  linkedin: 'linkedin',
  pinterest: 'pinterest',
  tiktok: 'tiktok',
  x: 'x',
  youtube: 'youtube',
};

export function CreatorConnectorIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === 'website') return <Globe2 aria-hidden="true" size={22} />;
  const file = iconFiles[platform];
  return file ? (
    <Image
      alt=""
      aria-hidden="true"
      height={22}
      src={`/connectors/${file}.svg`}
      unoptimized
      width={22}
    />
  ) : null;
}
