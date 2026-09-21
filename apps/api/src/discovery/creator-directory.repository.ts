import { Injectable } from '@nestjs/common';
import { defaultStorefrontTheme } from '@vibeshub/contracts';
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
  avatarUrl: string | null;
  bioText: string;
  categoryName: string;
  categorySlug: string;
  displayName: string;
  followerCount: number;
  handle: string;
  id: string;
  isVerified: boolean;
  recommendationCount: number;
  brands?: CreatorStorefront['brands'];
  socialLinks?: CreatorStorefront['socialLinks'];
  storefrontSections?: CreatorStorefront['storefrontSections'];
  curatedSections?: CreatorStorefront['curatedSections'];
  contentOrder?: CreatorStorefront['contentOrder'];
  theme?: CreatorStorefront['theme'];
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
        avatar.public_url as "avatarUrl",
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
          join app.affiliate_links affiliate_link
            on affiliate_link.recommendation_id = recommendation.id
           and affiliate_link.status = 'active'
          join app.merchant_domains merchant_domain
            on merchant_domain.id = affiliate_link.merchant_domain_id
           and merchant_domain.allow_redirect = true
          where recommendation.creator_id = creator.id
            and recommendation.lifecycle = 'published'
            and recommendation.deleted_at is null
        ) as "recommendationCount"
      from app.creator_profiles creator
      join app.categories category on category.id = creator.primary_category_id
      left join app.media_assets avatar
        on avatar.id = creator.avatar_media_asset_id
       and avatar.status = 'ready'
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
        avatar.public_url as "avatarUrl",
        creator.handle::text as handle,
        creator.display_name as "displayName",
        creator.bio_he as "bioText",
        creator.follower_count as "followerCount",
        creator.is_verified as "isVerified",
        category.slug::text as "categorySlug",
        category.name_en as "categoryName",
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'platform', link.platform,
                'url', link.url,
                'handle', link.handle
              ) order by link.sort_order, link.id
            )
            from app.creator_social_links link
            where link.creator_id = creator.id
          ),
          '[]'::jsonb
        ) as "socialLinks",
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', section_category.id,
                'slug', section_category.slug::text,
                'name', section_category.name_en
              ) order by section.position, section.category_id
            )
            from app.creator_storefront_sections section
            join app.categories section_category
              on section_category.id = section.category_id
             and section_category.is_active = true
            where section.creator_id = creator.id
          ),
          '[]'::jsonb
        ) as "storefrontSections",
        coalesce(
          (
            select jsonb_agg(jsonb_build_object(
              'id', creator_brand.id,
              'brandId', brand.id,
              'name', coalesce(creator_brand.display_name, brand.name),
              'websiteUrl', creator_brand.website_url,
              'itemCount', (select count(*)::integer from app.recommendations recommendation join app.products product on product.id = recommendation.product_id where recommendation.creator_id = creator.id and product.brand_id = brand.id and recommendation.lifecycle = 'published' and recommendation.deleted_at is null),
              'collectionCount', (select count(*)::integer from app.creator_curated_sections section where section.creator_id = creator.id and section.brand_id = brand.id and section.kind = 'collection')
            ) order by creator_brand.position)
            from app.creator_brands creator_brand
            join app.brands brand on brand.id = creator_brand.brand_id
            where creator_brand.creator_id = creator.id and creator_brand.lifecycle = 'active'
          ), '[]'::jsonb
        ) as brands,
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', section.id,
                'kind', section.kind,
                'brandId', section.brand_id,
                'title', section.title,
                'description', section.description,
                'imageUrl', section.image_url,
                'showItemsIndividually', section.show_items_individually,
                'parentCollectionId', section.parent_collection_id,
                'recommendationIds', coalesce(
                  (select jsonb_agg(item.recommendation_id order by item.position)
                   from app.creator_curated_section_items item
                   where item.section_id = section.id),
                  '[]'::jsonb
                )
              ) order by section.position
            )
            from app.creator_curated_sections section
            where section.creator_id = creator.id
          ),
          '[]'::jsonb
        ) as "curatedSections",
        coalesce((select content_order from app.creator_storefront_preferences where creator_id = creator.id), '[]'::jsonb) as "contentOrder",
        (select theme from app.creator_storefront_preferences where creator_id = creator.id) as theme,
        (
          select count(*)::integer
          from app.recommendations recommendation
          join app.affiliate_links affiliate_link
            on affiliate_link.recommendation_id = recommendation.id
           and affiliate_link.status = 'active'
          join app.merchant_domains merchant_domain
            on merchant_domain.id = affiliate_link.merchant_domain_id
           and merchant_domain.allow_redirect = true
          where recommendation.creator_id = creator.id
            and recommendation.lifecycle = 'published'
            and recommendation.deleted_at is null
        ) as "recommendationCount"
      from app.creator_profiles creator
      join app.categories category on category.id = creator.primary_category_id
      left join app.media_assets avatar
        on avatar.id = creator.avatar_media_asset_id
       and avatar.status = 'ready'
      where creator.handle = ${handle}
        and creator.status = 'approved'
        and creator.published_at is not null
        and category.is_active = true
    `;
    return row
      ? {
          ...mapCreatorCard(row),
          brands: row.brands ?? [],
          socialLinks: row.socialLinks ?? [],
          storefrontSections: row.storefrontSections ?? [],
          curatedSections: row.curatedSections ?? [],
          contentOrder: Array.isArray(row.contentOrder) ? row.contentOrder : [],
          theme: row.theme ?? defaultStorefrontTheme,
        }
      : null;
  }
}

function mapCreatorCard(row: CreatorCardRow): CreatorCard {
  return {
    avatarUrl: row.avatarUrl,
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
