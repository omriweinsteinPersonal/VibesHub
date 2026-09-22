import type { CreatorProfileSocialLink } from '@vibeshub/contracts';

type SocialPlatform = CreatorProfileSocialLink['platform'];

export const creatorConnectors: Array<{
  label: string;
  placeholder: string;
  platform: SocialPlatform;
}> = [
  {
    label: 'Instagram',
    placeholder: 'https://instagram.com/yourname',
    platform: 'instagram',
  },
  { label: 'TikTok', placeholder: 'https://tiktok.com/@yourname', platform: 'tiktok' },
  {
    label: 'LinkedIn',
    placeholder: 'https://linkedin.com/in/yourname',
    platform: 'linkedin',
  },
  { label: 'X', placeholder: 'https://x.com/yourname', platform: 'x' },
  { label: 'YouTube', placeholder: 'https://youtube.com/@yourname', platform: 'youtube' },
  {
    label: 'Facebook',
    placeholder: 'https://facebook.com/yourname',
    platform: 'facebook',
  },
  {
    label: 'Pinterest',
    placeholder: 'https://pinterest.com/yourname',
    platform: 'pinterest',
  },
  { label: 'Website', placeholder: 'https://yourwebsite.com', platform: 'website' },
];

export function connectorLabel(platform: SocialPlatform): string {
  return (
    creatorConnectors.find((connector) => connector.platform === platform)?.label ??
    platform
  );
}
