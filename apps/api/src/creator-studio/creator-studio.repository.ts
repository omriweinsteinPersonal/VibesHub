import { Injectable } from '@nestjs/common';
import type {
  CreatorMediaKit,
  CreatorMediaKitInput,
  CreatorStorefrontConfiguration,
  CreatorStorefrontConfigurationInput,
  CreatorStudioSummary,
} from '@vibeshub/contracts';

import { Database, type DatabaseClient } from '../database.js';

interface CreatorIdentityRow {
  avatarUrl: string | null;
  displayName: string;
  handle: string;
  id: string;
}

interface StorefrontSectionRow {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  position: number;
  version: number;
}

interface MediaKitRow {
  agentAgencyName: string | null;
  agentEmail: string | null;
  agentPhone: string | null;
  audienceAgeFrom: number | null;
  audienceAgeTo: number | null;
  audienceGender: CreatorMediaKit['audienceGender'];
  audienceLocation: string | null;
  averageReelViews: string | null;
  averageStoryViews: string | null;
  bookingEmail: string | null;
  contentTypes: CreatorMediaKit['contentTypes'];
  engagementRate: string | null;
  followers: string | null;
  platforms: CreatorMediaKit['platforms'];
  ratePerPostMinor: number | null;
  ratePerStoryMinor: number | null;
  version: number;
}

export type CreatorStudioUpdateResult<T> =
  | { kind: 'invalid_categories' }
  | { kind: 'not_found' }
  | { actualVersion: number; kind: 'version_conflict' }
  | { data: T; kind: 'updated' };

@Injectable()
export class CreatorStudioRepository {
  constructor(private readonly database: Database) {}

  async getSummary(userId: string): Promise<CreatorStudioSummary | null> {
    const [row] = await this.database.sql<
      (CreatorIdentityRow & {
        brandDiscounts: number;
        recommendationCount: number;
        storyClips: number;
      })[]
    >`
      select
        creator.id,
        creator.handle::text as handle,
        creator.display_name as "displayName",
        avatar.public_url as "avatarUrl",
        (
          select count(*)::integer
          from app.recommendations recommendation
          where recommendation.creator_id = creator.id
            and recommendation.lifecycle <> 'archived'
            and recommendation.deleted_at is null
        ) as "recommendationCount",
        (
          select count(*)::integer
          from app.discount_codes discount
          where discount.creator_id = creator.id
            and discount.lifecycle_status <> 'archived'
            and discount.deleted_at is null
            and not exists (
              select 1
              from app.recommendation_discount_codes placement
              where placement.code_id = discount.id
            )
        ) as "brandDiscounts",
        (
          select count(*)::integer
          from app.recommendation_story_clips clip
          join app.recommendations recommendation
            on recommendation.id = clip.recommendation_id
          where recommendation.creator_id = creator.id
            and recommendation.lifecycle <> 'archived'
            and recommendation.deleted_at is null
        ) as "storyClips"
      from app.creator_profiles creator
      left join app.media_assets avatar
        on avatar.id = creator.avatar_media_asset_id
       and avatar.status = 'ready'
      where creator.user_id = ${userId}
        and creator.status = 'approved'
        and creator.published_at is not null
    `;
    return row
      ? {
          avatarUrl: row.avatarUrl,
          counts: {
            brandDiscounts: row.brandDiscounts,
            recommendations: row.recommendationCount,
            storyClips: row.storyClips,
          },
          displayName: row.displayName,
          handle: row.handle,
          id: row.id,
        }
      : null;
  }

  async getStorefrontConfiguration(
    userId: string,
  ): Promise<CreatorStorefrontConfiguration | null> {
    const identity = await this.findCreator(this.database.sql, userId);
    if (!identity) return null;
    return this.readStorefrontConfiguration(this.database.sql, identity.id);
  }

  async replaceStorefrontConfiguration(
    userId: string,
    expectedVersion: number,
    input: CreatorStorefrontConfigurationInput,
  ): Promise<CreatorStudioUpdateResult<CreatorStorefrontConfiguration>> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const identity = await this.findCreator(sql, userId, true);
      if (!identity) return { kind: 'not_found' };
      await sql`
        insert into app.creator_storefront_preferences (creator_id)
        values (${identity.id})
        on conflict (creator_id) do nothing
      `;
      const [preference] = await sql<{ version: number }[]>`
        select version
        from app.creator_storefront_preferences
        where creator_id = ${identity.id}
        for update
      `;
      if (!preference) throw new Error('Creator storefront preference is missing');
      if (preference.version !== expectedVersion) {
        return { actualVersion: preference.version, kind: 'version_conflict' };
      }
      const [categoryCount] = await sql<{ count: number }[]>`
        select count(*)::integer as count
        from app.categories
        where id = any(${input.categoryIds}::uuid[])
          and is_active = true
      `;
      if ((categoryCount?.count ?? 0) !== input.categoryIds.length) {
        return { kind: 'invalid_categories' };
      }

      await sql`delete from app.creator_storefront_sections where creator_id = ${identity.id}`;
      for (const [position, categoryId] of input.categoryIds.entries()) {
        await sql`
          insert into app.creator_storefront_sections (creator_id, category_id, position)
          values (${identity.id}, ${categoryId}, ${position})
        `;
      }
      await sql`
        update app.creator_storefront_preferences
        set version = version + 1
        where creator_id = ${identity.id}
      `;
      return {
        data: await this.readStorefrontConfiguration(sql, identity.id),
        kind: 'updated',
      };
    });
  }

  async getMediaKit(userId: string): Promise<CreatorMediaKit | null> {
    const identity = await this.findCreator(this.database.sql, userId);
    if (!identity) return null;
    const row = await this.ensureAndReadMediaKit(this.database.sql, identity.id);
    return mapMediaKit(row);
  }

  async replaceMediaKit(
    userId: string,
    expectedVersion: number,
    input: CreatorMediaKitInput,
  ): Promise<CreatorStudioUpdateResult<CreatorMediaKit>> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const identity = await this.findCreator(sql, userId, true);
      if (!identity) return { kind: 'not_found' };
      await sql`
        insert into app.creator_media_kits (creator_id)
        values (${identity.id})
        on conflict (creator_id) do nothing
      `;
      const current = await this.readMediaKit(sql, identity.id, true);
      if (current.version !== expectedVersion) {
        return { actualVersion: current.version, kind: 'version_conflict' };
      }
      await sql`
        update app.creator_media_kits
        set
          followers = ${input.followers},
          engagement_rate = ${input.engagementRate},
          average_story_views = ${input.averageStoryViews},
          average_reel_views = ${input.averageReelViews},
          audience_age_from = ${input.audienceAgeFrom},
          audience_age_to = ${input.audienceAgeTo},
          rate_per_post_minor = ${input.ratePerPostMinor},
          rate_per_story_minor = ${input.ratePerStoryMinor},
          audience_gender = ${input.audienceGender},
          audience_location = ${input.audienceLocation},
          platforms = ${input.platforms},
          content_types = ${input.contentTypes},
          booking_email = ${input.bookingEmail},
          agent_agency_name = ${input.agentAgencyName},
          agent_email = ${input.agentEmail},
          agent_phone = ${input.agentPhone},
          version = version + 1
        where creator_id = ${identity.id}
          and version = ${expectedVersion}
      `;
      return {
        data: mapMediaKit(await this.readMediaKit(sql, identity.id)),
        kind: 'updated',
      };
    });
  }

  private async findCreator(
    sql: DatabaseClient,
    userId: string,
    lock = false,
  ): Promise<CreatorIdentityRow | null> {
    const rows = lock
      ? await sql<CreatorIdentityRow[]>`
          select
            creator.id,
            creator.handle::text as handle,
            creator.display_name as "displayName",
            avatar.public_url as "avatarUrl"
          from app.creator_profiles creator
          left join app.media_assets avatar
            on avatar.id = creator.avatar_media_asset_id and avatar.status = 'ready'
          where creator.user_id = ${userId}
            and creator.status = 'approved'
            and creator.published_at is not null
          for update of creator
        `
      : await sql<CreatorIdentityRow[]>`
          select
            creator.id,
            creator.handle::text as handle,
            creator.display_name as "displayName",
            avatar.public_url as "avatarUrl"
          from app.creator_profiles creator
          left join app.media_assets avatar
            on avatar.id = creator.avatar_media_asset_id and avatar.status = 'ready'
          where creator.user_id = ${userId}
            and creator.status = 'approved'
            and creator.published_at is not null
        `;
    return rows[0] ?? null;
  }

  private async readStorefrontConfiguration(
    sql: DatabaseClient,
    creatorId: string,
  ): Promise<CreatorStorefrontConfiguration> {
    await sql`
      insert into app.creator_storefront_preferences (creator_id)
      values (${creatorId})
      on conflict (creator_id) do nothing
    `;
    const rows = await sql<StorefrontSectionRow[]>`
      select
        category.id as "categoryId",
        category.slug::text as "categorySlug",
        category.name_en as "categoryName",
        section.position,
        preference.version
      from app.creator_storefront_preferences preference
      left join app.creator_storefront_sections section
        on section.creator_id = preference.creator_id
      left join app.categories category on category.id = section.category_id
      where preference.creator_id = ${creatorId}
      order by section.position
    `;
    return {
      sections: rows.flatMap((row) =>
        row.categoryId
          ? [
              {
                category: {
                  id: row.categoryId,
                  name: row.categoryName,
                  slug: row.categorySlug,
                },
                position: row.position,
              },
            ]
          : [],
      ),
      version: rows[0]?.version ?? 1,
    };
  }

  private async ensureAndReadMediaKit(
    sql: DatabaseClient,
    creatorId: string,
  ): Promise<MediaKitRow> {
    await sql`
      insert into app.creator_media_kits (creator_id)
      values (${creatorId})
      on conflict (creator_id) do nothing
    `;
    return this.readMediaKit(sql, creatorId);
  }

  private async readMediaKit(
    sql: DatabaseClient,
    creatorId: string,
    lock = false,
  ): Promise<MediaKitRow> {
    const selection = sql`
      select
        followers::text as followers,
        engagement_rate::text as "engagementRate",
        average_story_views::text as "averageStoryViews",
        average_reel_views::text as "averageReelViews",
        audience_age_from as "audienceAgeFrom",
        audience_age_to as "audienceAgeTo",
        rate_per_post_minor as "ratePerPostMinor",
        rate_per_story_minor as "ratePerStoryMinor",
        audience_gender as "audienceGender",
        audience_location as "audienceLocation",
        platforms,
        content_types as "contentTypes",
        booking_email::text as "bookingEmail",
        agent_agency_name as "agentAgencyName",
        agent_email::text as "agentEmail",
        agent_phone as "agentPhone",
        version
      from app.creator_media_kits
      where creator_id = ${creatorId}
    `;
    const rows = lock
      ? await sql<MediaKitRow[]>`${selection} for update`
      : await sql<MediaKitRow[]>`${selection}`;
    const row = rows[0];
    if (!row) throw new Error('Creator media kit is missing');
    return row;
  }
}

function mapMediaKit(row: MediaKitRow): CreatorMediaKit {
  return {
    agentAgencyName: row.agentAgencyName,
    agentEmail: row.agentEmail,
    agentPhone: row.agentPhone,
    audienceAgeFrom: row.audienceAgeFrom,
    audienceAgeTo: row.audienceAgeTo,
    audienceGender: row.audienceGender,
    audienceLocation: row.audienceLocation,
    averageReelViews: row.averageReelViews === null ? null : Number(row.averageReelViews),
    averageStoryViews:
      row.averageStoryViews === null ? null : Number(row.averageStoryViews),
    bookingEmail: row.bookingEmail,
    contentTypes: row.contentTypes,
    engagementRate: row.engagementRate === null ? null : Number(row.engagementRate),
    followers: row.followers === null ? null : Number(row.followers),
    platforms: row.platforms,
    ratePerPostMinor: row.ratePerPostMinor,
    ratePerStoryMinor: row.ratePerStoryMinor,
    version: row.version,
  };
}
