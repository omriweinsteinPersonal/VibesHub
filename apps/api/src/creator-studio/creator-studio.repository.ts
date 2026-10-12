import { Injectable } from '@nestjs/common';
import type {
  CreatorMediaKit,
  CreatorMediaKitInput,
  CreatorStorefrontConfiguration,
  CreatorStorefrontConfigurationInput,
  CreatorStudioSummary,
  StorefrontTheme,
  StorefrontThemeConfiguration,
} from '@vibeshub/contracts';
import {
  creatorStorefrontConfigurationSchema,
  storefrontThemeSchema,
} from '@vibeshub/contracts';

import { Database, type DatabaseClient } from '../database.js';

interface CreatorIdentityRow {
  avatarUrl: string | null;
  displayName: string;
  handle: string;
  id: string;
}

interface StorefrontSectionRow {
  contentOrder: CreatorStorefrontConfiguration['contentOrder'];
  labels: CreatorStorefrontConfiguration['labels'];
  featuredMedia: CreatorStorefrontConfiguration['featuredMedia'];
  titles: CreatorStorefrontConfiguration['titles'];
  brandOrder: string[];
  hiddenBrandIds: string[];
  hiddenCollectionIds: string[];
  hiddenRecommendationIds: string[];
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  position: number;
  version: number;
}

interface CuratedSectionRow {
  brandId: string | null;
  contentItemsJson: unknown;
  displayStyleJson: string | null;
  id: string;
  kind: 'section' | 'collection' | 'page';
  title: string;
  description: string;
  imageUrl: string | null;
  parentCollectionId: string | null;
  recommendationIds: string[];
  showItemsIndividually: boolean;
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
  | { kind: 'invalid_recommendations'; reason?: string }
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
        collections: number;
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
          from app.creator_curated_sections section
          where section.creator_id = creator.id
            and section.kind = 'collection'
        ) as collections,
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
            collections: row.collections,
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

  async getStorefrontTheme(userId: string): Promise<StorefrontThemeConfiguration | null> {
    const identity = await this.findCreator(this.database.sql, userId);
    if (!identity) return null;
    return this.readStorefrontTheme(this.database.sql, identity.id);
  }

  async replaceStorefrontTheme(
    userId: string,
    expectedVersion: number,
    theme: StorefrontTheme,
  ): Promise<CreatorStudioUpdateResult<StorefrontThemeConfiguration>> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const identity = await this.findCreator(sql, userId, true);
      if (!identity) return { kind: 'not_found' };
      await sql`
        insert into app.creator_storefront_preferences (creator_id)
        values (${identity.id})
        on conflict (creator_id) do nothing
      `;
      const [row] = await sql<{ themeVersion: number }[]>`
        select theme_version as "themeVersion"
        from app.creator_storefront_preferences
        where creator_id = ${identity.id}
        for update
      `;
      if (!row) return { kind: 'not_found' };
      if (row.themeVersion !== expectedVersion)
        return { actualVersion: row.themeVersion, kind: 'version_conflict' };
      await sql`
        update app.creator_storefront_preferences
        set theme = theme || ${sql.json(theme)}, theme_version = theme_version + 1
        where creator_id = ${identity.id}
      `;
      return { data: await this.readStorefrontTheme(sql, identity.id), kind: 'updated' };
    });
  }

  private async readStorefrontTheme(
    sql: DatabaseClient,
    creatorId: string,
  ): Promise<StorefrontThemeConfiguration> {
    await sql`
      insert into app.creator_storefront_preferences (creator_id)
      values (${creatorId})
      on conflict (creator_id) do nothing
    `;
    const [row] = await sql<{ theme: StorefrontTheme; version: number }[]>`
      select theme, theme_version as version
      from app.creator_storefront_preferences
      where creator_id = ${creatorId}
    `;
    if (!row) throw new Error('Creator storefront theme is missing');
    return { theme: storefrontThemeSchema.parse(row.theme), version: row.version };
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
      const ownedRecommendations = await sql<{ id: string }[]>`
        select recommendation.id
        from app.recommendations recommendation
        where recommendation.creator_id = ${identity.id}
          and recommendation.lifecycle <> 'archived'
          and recommendation.deleted_at is null
      `;
      const ownedRecommendationIds = new Set(ownedRecommendations.map(({ id }) => id));
      const [ownedDiscounts, ownedBrands] = await Promise.all([
        sql<{ id: string }[]>`
          select discount.id
          from app.discount_codes discount
          where discount.creator_id = ${identity.id}
            and discount.lifecycle_status <> 'archived'
            and discount.deleted_at is null
        `,
        sql<{ id: string; brandId: string }[]>`
          select brand.id, brand.brand_id as "brandId"
          from app.creator_brands brand
          where brand.creator_id = ${identity.id}
            and brand.lifecycle = 'active'
        `,
      ]);
      const ownedDiscountIds = new Set(ownedDiscounts.map(({ id }) => id));
      const ownedBrandIds = new Set(ownedBrands.map(({ id }) => id));
      const ownedCatalogBrandIds = new Set(ownedBrands.map(({ brandId }) => brandId));
      const creatorBrandIdByCatalogId = new Map(
        ownedBrands.map(({ id, brandId }) => [brandId, id]),
      );
      const featuredMediaIds = new Set(input.featuredMedia.map(({ id }) => id));
      const validCollectionIds = new Set(
        input.curatedSections
          .filter(
            (section) =>
              section.kind === 'collection' &&
              section.brandId !== null &&
              ownedCatalogBrandIds.has(section.brandId),
          )
          .map(({ id }) => id),
      );
      const validSections = input.curatedSections.filter(
        (section) => section.kind !== 'collection' || validCollectionIds.has(section.id),
      );
      const contentOrderKeys = new Set<string>();
      input = {
        ...input,
        contentOrder: input.contentOrder.filter(({ kind, id }) => {
          const key = `${kind}:${id}`;
          if (contentOrderKeys.has(key)) return false;
          contentOrderKeys.add(key);
          if (kind === 'recommendation') return ownedRecommendationIds.has(id);
          if (kind === 'discount') return ownedDiscountIds.has(id);
          if (kind === 'media') return featuredMediaIds.has(id);
          if (kind === 'collection') return validCollectionIds.has(id);
          if (kind === 'section') {
            return validSections.some(
              (section) => section.id === id && section.kind === 'section',
            );
          }
          return true;
        }),
        curatedSections: validSections.map((section) => {
          const contentItems = section.contentItems.map((item) =>
            item.kind === 'brand' && creatorBrandIdByCatalogId.has(item.id)
              ? { ...item, id: creatorBrandIdByCatalogId.get(item.id)! }
              : item,
          );
          const validContentItems = contentItems.filter((item) => {
            if (item.kind === 'recommendation')
              return ownedRecommendationIds.has(item.id);
            if (item.kind === 'media') return featuredMediaIds.has(item.id);
            if (item.kind === 'brand') return ownedBrandIds.has(item.id);
            return validCollectionIds.has(item.id);
          });
          const contentRecommendationIds = validContentItems
            .filter(({ kind }) => kind === 'recommendation')
            .map(({ id }) => id);
          return {
            ...section,
            recommendationIds: [
              ...new Set([...section.recommendationIds, ...contentRecommendationIds]),
            ].filter((id) => ownedRecommendationIds.has(id)),
            contentItems: validContentItems,
          };
        }),
        labels: input.labels.map((label) => ({
          ...label,
          recommendationIds: label.recommendationIds.filter((id) =>
            ownedRecommendationIds.has(id),
          ),
          collectionIds: label.collectionIds.filter((id) => validCollectionIds.has(id)),
          brandIds: label.brandIds.filter((id) => ownedBrandIds.has(id)),
        })),
      };
      const [categoryCount] = await sql<{ count: number }[]>`
        select count(*)::integer as count
        from app.categories
        where id = any(${input.categoryIds}::uuid[])
          and is_active = true
      `;
      if ((categoryCount?.count ?? 0) !== input.categoryIds.length) {
        return { kind: 'invalid_categories' };
      }
      const orderedIds = input.contentOrder.map(({ kind, id }) => `${kind}:${id}`);
      if (new Set(orderedIds).size !== orderedIds.length)
        return {
          kind: 'invalid_recommendations',
          reason: 'duplicate content order entry',
        };
      const orderedRecommendations = input.contentOrder
        .filter(({ kind }) => kind === 'recommendation')
        .map(({ id }) => id);
      const orderedDiscounts = input.contentOrder
        .filter(({ kind }) => kind === 'discount')
        .map(({ id }) => id);
      const orderedMedia = input.contentOrder
        .filter(({ kind }) => kind === 'media')
        .map(({ id }) => id);
      const orderedSections = input.contentOrder.filter(
        ({ kind }) => kind === 'collection' || kind === 'section',
      );
      if (
        input.curatedSections.some(
          (section) =>
            section.kind === 'page' &&
            section.parentCollectionId !== null &&
            !input.curatedSections.some(
              (parent) =>
                parent.kind === 'collection' &&
                parent.id === section.parentCollectionId &&
                parent.brandId === section.brandId,
            ),
        )
      )
        return {
          kind: 'invalid_recommendations',
          reason: 'invalid page or curated section order',
        };
      const orderedCategories = input.contentOrder
        .filter(({ kind }) => kind === 'category')
        .map(({ id }) => id);
      if (
        orderedCategories.some((id) => !input.categoryIds.includes(id)) ||
        orderedSections.some(
          ({ id, kind }) =>
            !input.curatedSections.some(
              (section) => section.id === id && section.kind === kind,
            ),
        )
      )
        return {
          kind: 'invalid_recommendations',
          reason: 'invalid category or curated section order',
        };
      if (
        orderedMedia.some((id) => !input.featuredMedia.some((media) => media.id === id))
      )
        return {
          kind: 'invalid_recommendations',
          reason: 'content order references unavailable media',
        };
      const [orderOwnership] = await sql<
        { recommendations: number; discounts: number }[]
      >`
        select
          (select count(*)::integer from app.recommendations where creator_id = ${identity.id} and id = any(${orderedRecommendations}::uuid[]) and lifecycle <> 'archived' and deleted_at is null) as recommendations,
          (select count(*)::integer from app.discount_codes where creator_id = ${identity.id} and id = any(${orderedDiscounts}::uuid[]) and lifecycle_status <> 'archived' and deleted_at is null) as discounts
      `;
      if (
        orderOwnership?.recommendations !== orderedRecommendations.length ||
        orderOwnership.discounts !== orderedDiscounts.length
      )
        return {
          kind: 'invalid_recommendations',
          reason: 'content order contains inactive content',
        };
      const recommendationIds = [
        ...new Set([
          ...input.curatedSections.flatMap((section) => section.recommendationIds),
          ...input.curatedSections.flatMap((section) =>
            section.contentItems
              .filter(({ kind }) => kind === 'recommendation')
              .map(({ id }) => id),
          ),
          ...input.labels.flatMap((label) => label.recommendationIds),
        ]),
      ];
      const mediaIds = [
        ...new Set(
          input.curatedSections.flatMap((section) =>
            section.contentItems
              .filter(({ kind }) => kind === 'media')
              .map(({ id }) => id),
          ),
        ),
      ];
      const selectedBrandIds = [
        ...new Set(
          input.curatedSections.flatMap((section) =>
            section.contentItems
              .filter(({ kind }) => kind === 'brand')
              .map(({ id }) => id),
          ),
        ),
      ];
      const selectedCollectionIds = [
        ...new Set(
          input.curatedSections.flatMap((section) =>
            section.contentItems
              .filter(({ kind }) => kind === 'collection')
              .map(({ id }) => id),
          ),
        ),
      ];
      const collectionIds = new Set(input.labels.flatMap((label) => label.collectionIds));
      if (
        [...collectionIds].some(
          (id) =>
            !input.curatedSections.some(
              (section) => section.id === id && section.kind === 'collection',
            ),
        )
      )
        return {
          kind: 'invalid_recommendations',
          reason: 'label references an unknown collection',
        };
      const brandIds = new Set(input.labels.flatMap((label) => label.brandIds));
      if (brandIds.size) {
        const [ownedBrands] = await sql<{ count: number }[]>`
          select count(*)::integer as count
          from app.creator_brands
          where creator_id = ${identity.id}
            and id = any(${[...brandIds]}::uuid[])
            and lifecycle = 'active'
        `;
        if (ownedBrands?.count !== brandIds.size)
          return {
            kind: 'invalid_recommendations',
            reason: 'label references an inactive brand',
          };
      }
      if (recommendationIds.length) {
        const [owned] = await sql<{ count: number }[]>`
          select count(*)::integer as count
          from app.recommendations
          where creator_id = ${identity.id}
            and id = any(${recommendationIds}::uuid[])
            and lifecycle <> 'archived'
            and deleted_at is null
        `;
        if (owned?.count !== recommendationIds.length) {
          return {
            kind: 'invalid_recommendations',
            reason: 'recommendation ownership or lifecycle check failed',
          };
        }
      }
      if (mediaIds.some((id) => !input.featuredMedia.some((media) => media.id === id))) {
        return {
          kind: 'invalid_recommendations',
          reason: 'section references unavailable media',
        };
      }
      if (selectedBrandIds.length) {
        const [ownedBrands] = await sql<{ count: number }[]>`
          select count(*)::integer as count
          from app.creator_brands
          where creator_id = ${identity.id}
            and id = any(${selectedBrandIds}::uuid[])
            and lifecycle = 'active'
        `;
        if (ownedBrands?.count !== selectedBrandIds.length)
          return {
            kind: 'invalid_recommendations',
            reason: 'section references an inactive brand',
          };
      }
      if (
        selectedCollectionIds.some(
          (id) =>
            !input.curatedSections.some(
              (section) => section.id === id && section.kind === 'collection',
            ),
        )
      ) {
        return {
          kind: 'invalid_recommendations',
          reason: 'section references an unknown collection',
        };
      }
      for (const section of input.curatedSections) {
        if (section.kind === 'collection' && !section.brandId)
          return {
            kind: 'invalid_recommendations',
            reason: 'collection is missing its brand',
          };
      }

      await sql`delete from app.creator_storefront_sections where creator_id = ${identity.id}`;
      for (const [position, categoryId] of input.categoryIds.entries()) {
        await sql`
          insert into app.creator_storefront_sections (creator_id, category_id, position)
          values (${identity.id}, ${categoryId}, ${position})
        `;
      }
      await sql`delete from app.creator_curated_sections where creator_id = ${identity.id}`;
      const [generalSectionColumns] = await sql<{ available: boolean }[]>`
        select count(*) = 2 as available
        from information_schema.columns
        where table_schema = 'app'
          and table_name = 'creator_curated_sections'
          and column_name = any(${['display_style', 'content_items']}::text[])
      `;
      for (const [position, section] of input.curatedSections.entries()) {
        if (generalSectionColumns?.available) {
          await sql`
            insert into app.creator_curated_sections
              (id, creator_id, kind, brand_id, title, description, image_url, show_items_individually, parent_collection_id, display_style, content_items, position)
            values (${section.id}, ${identity.id}, ${section.kind}, ${section.brandId},
              ${section.title}, ${section.description}, ${section.imageUrl}, ${section.showItemsIndividually}, ${section.parentCollectionId}, ${section.displayStyle}, ${sql.json(section.contentItems)}, ${position})
          `;
        } else {
          await sql`
            insert into app.creator_curated_sections
              (id, creator_id, kind, brand_id, title, description, image_url, show_items_individually, parent_collection_id, position)
            values (${section.id}, ${identity.id}, ${section.kind}, ${section.brandId},
              ${section.title}, ${section.description}, ${section.imageUrl}, ${section.showItemsIndividually}, ${section.parentCollectionId}, ${position})
          `;
        }
        for (const [
          itemPosition,
          recommendationId,
        ] of section.recommendationIds.entries()) {
          await sql`
            insert into app.creator_curated_section_items
              (section_id, recommendation_id, position)
            values (${section.id}, ${recommendationId}, ${itemPosition})
          `;
        }
      }
      await sql`
        update app.creator_storefront_preferences
        set version = version + 1,
            content_order = ${sql.json(input.contentOrder)},
            navigation_labels = ${sql.json(input.labels)},
            titles = coalesce(${input.titles === undefined ? null : sql.json(input.titles)}, titles),
            featured_media = ${sql.json(input.featuredMedia)},
            brand_order = coalesce(${input.brandOrder === undefined ? null : sql.json(input.brandOrder)}, brand_order),
            hidden_brand_ids = ${sql.json(input.hiddenBrandIds ?? [])},
            hidden_collection_ids = ${sql.json(input.hiddenCollectionIds ?? [])},
            hidden_recommendation_ids = ${sql.json(input.hiddenRecommendationIds ?? [])}
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
        , preference.content_order as "contentOrder"
        , preference.navigation_labels as labels
        , preference.titles as titles
        , preference.featured_media as "featuredMedia"
        , preference.brand_order as "brandOrder"
        , preference.hidden_brand_ids as "hiddenBrandIds"
        , preference.hidden_collection_ids as "hiddenCollectionIds"
        , preference.hidden_recommendation_ids as "hiddenRecommendationIds"
      from app.creator_storefront_preferences preference
      left join app.creator_storefront_sections section
        on section.creator_id = preference.creator_id
      left join app.categories category on category.id = section.category_id
      where preference.creator_id = ${creatorId}
      order by section.position
    `;
    const curatedRows = await sql<CuratedSectionRow[]>`
      select
        section.id,
        section.kind,
        section.brand_id as "brandId",
        to_jsonb(section)->'content_items' as "contentItemsJson",
        to_jsonb(section)->>'display_style' as "displayStyleJson",
        section.title,
        section.description,
        section.image_url as "imageUrl",
        section.show_items_individually as "showItemsIndividually",
        section.parent_collection_id as "parentCollectionId",
        coalesce(jsonb_agg(item.recommendation_id order by item.position)
          filter (where item.recommendation_id is not null), '[]'::jsonb)
          as "recommendationIds"
      from app.creator_curated_sections section
      left join app.creator_curated_section_items item on item.section_id = section.id
      where section.creator_id = ${creatorId}
      group by section.id
      order by section.position
    `;
    return creatorStorefrontConfigurationSchema.parse({
      contentOrder: Array.isArray(rows[0]?.contentOrder) ? rows[0].contentOrder : [],
      featuredMedia: Array.isArray(rows[0]?.featuredMedia) ? rows[0].featuredMedia : [],
      curatedSections: curatedRows.map(
        ({ contentItemsJson, displayStyleJson, ...section }) => ({
          ...section,
          contentItems: Array.isArray(contentItemsJson)
            ? contentItemsJson
            : section.recommendationIds.map((id) => ({
                id,
                kind: 'recommendation' as const,
              })),
          displayStyle:
            displayStyleJson === 'vertical'
              ? ('vertical' as const)
              : ('horizontal' as const),
        }),
      ),
      labels: Array.isArray(rows[0]?.labels) ? rows[0].labels : [],
      titles: Array.isArray(rows[0]?.titles) ? rows[0].titles : [],
      brandOrder: rows[0]?.brandOrder ?? [],
      hiddenBrandIds: rows[0]?.hiddenBrandIds ?? [],
      hiddenCollectionIds: rows[0]?.hiddenCollectionIds ?? [],
      hiddenRecommendationIds: rows[0]?.hiddenRecommendationIds ?? [],
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
    });
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
