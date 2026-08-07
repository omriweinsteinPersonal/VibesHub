import type { CreatorCard } from '@vibeshub/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface CreatorCardViewProps {
  actions?: ReactNode;
  creator: CreatorCard;
}

export function CreatorCardView({ actions, creator }: CreatorCardViewProps) {
  return (
    <article className="creatorCard">
      <div className="creatorPortrait" aria-hidden="true">
        {initials(creator.displayName)}
      </div>
      <div className="creatorDetails">
        <div className="creatorTitle">
          <div>
            <h3>{creator.displayName}</h3>
            <p>@{creator.handle}</p>
          </div>
          {creator.verificationStatus === 'verified' ? (
            <span className="verifiedBadge" aria-label="Verified creator">
              ✓
            </span>
          ) : null}
        </div>
        <p className="creatorCategory">
          {creator.primaryCategory.name} creator · {compactNumber(creator.followerCount)}{' '}
          followers
        </p>
        <p className="creatorBio" dir="rtl" lang="he">
          {creator.bio.value}
        </p>
        <footer>
          <span>{creator.recommendationCount} recommendations</span>
          <Link className="creatorHandle" href={`/creators/${creator.handle}`}>
            View storefront →
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
