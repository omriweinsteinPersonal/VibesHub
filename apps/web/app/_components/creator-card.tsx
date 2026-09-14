import type { CreatorCard } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import { publicAssetUrl } from '../../lib/public-asset-url';

interface CreatorCardViewProps {
  actions?: ReactNode;
  creator: CreatorCard;
}

export function CreatorCardView({ actions, creator }: CreatorCardViewProps) {
  return (
    <article className="creatorCard">
      <Link
        className="creatorPortrait"
        href={`/creators/${creator.handle}`}
        aria-label={`View ${creator.displayName}'s storefront`}
      >
        {creator.avatarUrl ? (
          <Image
            alt={creator.displayName}
            fill
            sizes="(max-width: 800px) 100vw, 380px"
            src={publicAssetUrl(creator.avatarUrl)}
            unoptimized
          />
        ) : (
          initials(creator.displayName)
        )}
      </Link>
      <div className="creatorDetails">
        <div className="creatorTitle">
          <div className="creatorNameLine">
            <h3>{creator.displayName}</h3>
            {creator.verificationStatus === 'verified' ? (
              <span className="verifiedBadge" aria-label="Verified creator">
                <BadgeCheck aria-hidden="true" size={16} />
              </span>
            ) : null}
          </div>
          <p>
            <Users aria-hidden="true" size={14} />
            {compactNumber(creator.followerCount)} followers
          </p>
        </div>
        <p className="creatorCategory">{creator.primaryCategory.name} creator</p>
        <p className="creatorBio" dir="rtl" lang="he">
          {creator.bio.value}
        </p>
        <footer>
          <span>{creator.recommendationCount} recommendations</span>
          <Link className="creatorHandle" href={`/creators/${creator.handle}`}>
            View Profile
          </Link>
        </footer>
        {actions ? <div className="creatorCardActions">{actions}</div> : null}
      </div>
    </article>
  );
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
