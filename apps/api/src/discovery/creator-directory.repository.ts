import { Injectable } from '@nestjs/common';
import type {
  CreatorCard,
  CreatorDirectoryQuery,
  CreatorStorefront,
} from '@vibeshub/contracts';

import { Database } from '../database.js';
import {
  type CreatorDirectoryCursor,
  encodeCreatorDirectoryCursor,
} from './creator-directory.js';

interface CreatorCardRow {
  bioText: string;
  categoryName: string;
  categorySlug: string;
  displayName: string;
  followerCount: number;
  handle: string;
  id: string;
  isVerified: boolean;
  recommendationCount: number;
}

export interface CreatorDirectoryPage {
  items: CreatorCard[];
  nextCursor: string | null;
}

@Injectable()
export class CreatorDirectoryRepository {
  constructor(private readonly database: Database) {}

  async list(
    query: CreatorDirectoryQuery,
    cursor: CreatorDirectoryCursor | null,
  ): Promise<CreatorDirectoryPage> {
    const searchPattern = query.q ? `%${query.q}%` : null;
    const rows = await this.database.sql<CreatorCardRow[]>`
      select
        creator.id,
        creator.handle::text as handle,
        creator.display_name as "displayName",
        creator.bio_he as "bioText",
        creator.follower_count as "followerCount",
        creator.is_verified as "isVerified",
        category.slug::text as "categorySlug",
        category.name_en as "categoryName",
        (
          select count(*)::integer
          from app.recommendations recommendation
          where recommendation.creator_id = creator.id
            and recommendation.lifecycle = 'published'
            and recommendation.deleted_at is null
        ) as "recommendationCount"
      from app.creator_profiles creator
      join app.categories category on category.id = creator.primary_category_id
      where creator.status = 'approved'
        and creator.published_at is not null
        and category.is_active = true
        and (${query.category ?? null}::text is null or category.slug::text = ${query.category ?? null})
        and (
          ${searchPattern}::text is null
          or creator.display_name ilike ${searchPattern}
          or creator.handle::text ilike ${searchPattern}
        )
        and (
          ${cursor?.id ?? null}::uuid is null
          or creator.follower_count < ${cursor?.followerCount ?? null}
          or (
            creator.follower_count = ${cursor?.followerCount ?? null}
            and creator.id < ${cursor?.id ?? null}::uuid
          )
        )
      order by creator.follower_count desc, creator.id desc
      limit ${query.limit + 1}
    `;

    const hasMore = rows.length > query.limit;
    const visibleRows = hasMore ? rows.slice(0, query.limit) : rows;
    const items = visibleRows.map(mapCreatorCard);
    const lastRow = visibleRows.at(-1);

    return {
      items,
      nextCursor:
        hasMore && lastRow
          ? encodeCreatorDirectoryCursor(
              { followerCount: lastRow.followerCount, id: lastRow.id },
              query,
            )
          : null,
    };
  }

  async findPublishedByHandle(handle: string): Promise<CreatorStorefront | null> {
    const [row] = await this.database.sql<CreatorCardRow[]>`
      select
        creator.id,
        creator.handle::text as handle,
        creator.display_name as "displayName",
        creator.bio_he as "bioText",
        creator.follower_count as "followerCount",
        creator.is_verified as "isVerified",
        category.slug::text as "categorySlug",
        category.name_en as "categoryName",
        (
          select count(*)::integer
          from app.recommendations recommendation
          where recommendation.creator_id = creator.id
            and recommendation.lifecycle = 'published'
            and recommendation.deleted_at is null
        ) as "recommendationCount"
      from app.creator_profiles creator
      join app.categories category on category.id = creator.primary_category_id
      where creator.handle = ${handle}
        and creator.status = 'approved'
        and creator.published_at is not null
        and category.is_active = true
    `;
    return row ? mapCreatorCard(row) : null;
  }
}

function mapCreatorCard(row: CreatorCardRow): CreatorCard {
  return {
    bio: { direction: 'rtl', language: 'he', value: row.bioText },
    displayName: row.displayName,
    followerCount: row.followerCount,
    handle: row.handle,
    id: row.id,
    primaryCategory: { name: row.categoryName, slug: row.categorySlug },
    recommendationCount: row.recommendationCount,
    verificationStatus: row.isVerified ? 'verified' : 'unverified',
  };
}
