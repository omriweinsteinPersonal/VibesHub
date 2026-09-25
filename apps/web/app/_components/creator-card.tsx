import type { CreatorCard } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';

import { publicAssetUrl } from '../../lib/public-asset-url';

interface CreatorCardViewProps {
  creator: CreatorCard;
}

export function CreatorCardView({ creator }: CreatorCardViewProps) {
  return (
    <article className="creatorCard storeProductCard">
      <Link
        className="creatorPortrait storeProductImage"
        href={`/${creator.handle}`}
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
      <div className="creatorDetails storeProductDetails">
        <div className="creatorTitle">
          <div className="creatorNameLine">
            <h3 dir="auto">{creator.displayName}</h3>
            {creator.verificationStatus === 'verified' ? (
              <span className="verifiedBadge" aria-label="Verified creator">
                <BadgeCheck aria-hidden="true" size={16} />
              </span>
            ) : null}
          </div>
        </div>
        <p className="creatorCategory">{creator.primaryCategory.name} creator</p>
        <p className="creatorBio" dir={creator.bio.direction} lang={creator.bio.language}>
          {creator.bio.value}
        </p>
        <footer>
          <span className="creatorRecommendationCount">
            {creator.recommendationCount} recommendations
          </span>
          <Link className="creatorHandle" href={`/${creator.handle}`}>
            View Profile
          </Link>
        </footer>
      </div>
    </article>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
