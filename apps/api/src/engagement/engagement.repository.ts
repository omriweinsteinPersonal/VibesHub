import { Injectable } from '@nestjs/common';
import type {
  CreatorCard,
  DiscountCodeVerificationStatus,
  EngagementState,
  EngagementStateInput,
  FollowedCreator,
  RecommendationCard,
  SavedProduct,
  SaveProductInput,
} from '@vibeshub/contracts';

import { parseApiConfig } from '../config.js';
import { Database } from '../database.js';
import { trackedRedirectUrl } from '../redirects/redirect-destination.js';
import { encodeEngagementCursor, type EngagementCursor } from './engagement.js';

interface CreatorRow {
  avatarUrl: string | null;
  bioText: string;
  categoryName: string;
  categorySlug: string;
  displayName: string;
  followedAt: string;
  followerCount: number;
  handle: string;
  id: string;
  isVerified: boolean;
  recommendationCount: number;
}

interface RecommendationRow {
  brandName: string;
  categoryName: string;
  categorySlug: string;
  commercialRelationship: RecommendationCard['commercialRelationship'];
  createdAt: string;
  discountCode: string | null;
  discountId: string | null;
  discountExpiresAt: string | null;
  discountLabel: string | null;
  discountLastVerifiedAt: string | null;
  discountVerificationStatus: DiscountCodeVerificationStatus | null;
  id: string;
  imageAssetId: string | null;
  imageUrl: string;
  lifecycle: RecommendationCard['lifecycle'];
  merchantHostname: string;
  priceAmountMinor: string;
  productId: string;
  productName: string;
  reviewHe: string;
  savedAt: string;
  shopPublicId: string;
  updatedAt: string;
  version: number;
  videoUrl: string | null;
}

export interface EngagementPage<T> {
  items: T[];
  nextCursor: string | null;
}

@Injectable()
export class EngagementRepository {
  private readonly redirectBaseUrl = parseApiConfig(process.env).redirectBaseUrl;

  constructor(private readonly database: Database) {}

  async getState(userId: string, input: EngagementStateInput): Promise<EngagementState> {
    const [followedCreators, savedProducts] = await Promise.all([
      input.creatorIds.length === 0
        ? Promise.resolve([])
        : this.database.sql<{ id: string }[]>`
            select creator_id as id
            from app.creator_follows
            where user_id = ${userId}
              and creator_id = any(${input.creatorIds}::uuid[])
          `,
      input.productIds.length === 0
        ? Promise.resolve([])
        : this.database.sql<{ id: string }[]>`
            select product_id as id
            from app.saved_products
            where user_id = ${userId}
              and product_id = any(${input.productIds}::uuid[])
          `,
    ]);
    return {
      followedCreatorIds: followedCreators.map(({ id }) => id),
      savedProductIds: savedProducts.map(({ id }) => id),
    };
  }

  async followCreator(userId: string, creatorId: string): Promise<boolean> {
    const [creator] = await this.database.sql<{ id: string }[]>`
      select id
      from app.creator_profiles
      where id = ${creatorId}
        and user_id <> ${userId}
        and status = 'approved'
        and published_at is not null
    `;
    if (!creator) return false;
    await this.database.sql`
      insert into app.creator_follows (user_id, creator_id)
      values (${userId}, ${creatorId})
      on conflict (user_id, creator_id) do nothing
    `;
    return true;
  }

  async unfollowCreator(userId: string, creatorId: string): Promise<void> {
    await this.database.sql`
      delete from app.creator_follows
      where user_id = ${userId} and creator_id = ${creatorId}
    `;
  }

  async saveProduct(
    userId: string,
    productId: string,
    input: SaveProductInput,
  ): Promise<boolean> {
    const [product] = await this.database.sql<{ id: string }[]>`
      select product.id
      from app.products product
      where product.id = ${productId}
        and product.status = 'active'
        and (
          ${input.sourceRecommendationId ?? null}::uuid is null
          or exists (
            select 1
            from app.recommendations recommendation
            join app.affiliate_links affiliate_link
              on affiliate_link.recommendation_id = recommendation.id
             and affiliate_link.status = 'active'
            join app.merchant_domains merchant_domain
              on merchant_domain.id = affiliate_link.merchant_domain_id
             and merchant_domain.allow_redirect = true
             and merchant_domain.verified_at is not null
            where recommendation.id = ${input.sourceRecommendationId ?? null}
              and recommendation.product_id = product.id
              and recommendation.lifecycle = 'published'
              and recommendation.deleted_at is null
          )
        )
    `;
    if (!product) return false;
    await this.database.sql`
      insert into app.saved_products (user_id, product_id, source_recommendation_id)
      values (${userId}, ${productId}, ${input.sourceRecommendationId ?? null})
      on conflict (user_id, product_id) do update
      set source_recommendation_id = coalesce(
        excluded.source_recommendation_id,
        app.saved_products.source_recommendation_id
      )
    `;
    return true;
  }

  async removeSavedProduct(userId: string, productId: string): Promise<void> {
    await this.database.sql`
      delete from app.saved_products
      where user_id = ${userId} and product_id = ${productId}
    `;
  }

  async listFollowedCreators(
    userId: string,
    limit: number,
    cursor: EngagementCursor | null,
  ): Promise<EngagementPage<FollowedCreator>> {
    const rows = await this.database.sql<CreatorRow[]>`
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
        follow.created_at as "followedAt",
        (
          select count(*)::integer
          from app.recommendations recommendation
          join app.affiliate_links affiliate_link
            on affiliate_link.recommendation_id = recommendation.id
           and affiliate_link.status = 'active'
          join app.merchant_domains merchant_domain
            on merchant_domain.id = affiliate_link.merchant_domain_id
           and merchant_domain.allow_redirect = true
           and merchant_domain.verified_at is not null
          where recommendation.creator_id = creator.id
            and recommendation.lifecycle = 'published'
            and recommendation.deleted_at is null
        ) as "recommendationCount"
      from app.creator_follows follow
      join app.creator_profiles creator on creator.id = follow.creator_id
      join app.categories category on category.id = creator.primary_category_id
      left join app.media_assets avatar
        on avatar.id = creator.avatar_media_asset_id
       and avatar.status = 'ready'
      where follow.user_id = ${userId}
        and creator.status = 'approved'
        and creator.published_at is not null
        and category.is_active = true
        and (
          ${cursor?.id ?? null}::uuid is null
          or follow.created_at < ${cursor?.timestamp ?? null}::timestamptz
          or (
            follow.created_at = ${cursor?.timestamp ?? null}::timestamptz
            and creator.id < ${cursor?.id ?? null}::uuid
          )
        )
      order by follow.created_at desc, creator.id desc
      limit ${limit + 1}
    `;
    return mapPage(
      rows,
      limit,
      'followed-creators',
      (row) => row.id,
      (row) => row.followedAt,
      (row) => ({
        creator: mapCreator(row),
        followedAt: row.followedAt,
      }),
    );
  }

  async listSavedProducts(
    userId: string,
    limit: number,
    cursor: EngagementCursor | null,
  ): Promise<EngagementPage<SavedProduct>> {
    const rows = await this.database.sql<RecommendationRow[]>`
      select
        saved.created_at as "savedAt",
        recommendation.id,
        recommendation.image_asset_id as "imageAssetId",
        coalesce(media.public_url, recommendation.image_url) as "imageUrl",
        recommendation.review_he as "reviewHe",
        recommendation.video_url as "videoUrl",
        placed_discount.code::text as "discountCode",
        placed_discount.id as "discountId",
        placed_discount.label as "discountLabel",
        placed_discount.expires_at as "discountExpiresAt",
        placed_discount.last_verified_at as "discountLastVerifiedAt",
        placed_discount.verification_status as "discountVerificationStatus",
        recommendation.commercial_relationship as "commercialRelationship",
        recommendation.lifecycle,
        recommendation.created_at as "createdAt",
        recommendation.updated_at as "updatedAt",
        recommendation.version,
        product.id as "productId",
        product.name as "productName",
        brand.name as "brandName",
        category.slug::text as "categorySlug",
        category.name_en as "categoryName",
        merchant_domain.hostname::text as "merchantHostname",
        affiliate_link.public_id::text as "shopPublicId",
        offer.price_amount_minor::text as "priceAmountMinor"
      from app.saved_products saved
      join app.products product on product.id = saved.product_id
      join lateral (
        select candidate.*
        from app.recommendations candidate
        where candidate.product_id = saved.product_id
          and candidate.lifecycle = 'published'
          and candidate.deleted_at is null
          and exists (
            select 1
            from app.affiliate_links candidate_link
            join app.merchant_domains candidate_domain
              on candidate_domain.id = candidate_link.merchant_domain_id
             and candidate_domain.allow_redirect = true
             and candidate_domain.verified_at is not null
            where candidate_link.recommendation_id = candidate.id
              and candidate_link.status = 'active'
          )
        order by
          (candidate.id = saved.source_recommendation_id) desc,
          candidate.published_at desc,
          candidate.id desc
        limit 1
      ) recommendation on true
      join app.brands brand on brand.id = product.brand_id
      join app.categories category on category.id = product.primary_category_id
      join app.product_offers offer on offer.id = recommendation.offer_id
      join app.merchants merchant on merchant.id = offer.merchant_id
      join app.affiliate_links affiliate_link
        on affiliate_link.recommendation_id = recommendation.id
       and affiliate_link.status = 'active'
      join app.merchant_domains merchant_domain
        on merchant_domain.id = affiliate_link.merchant_domain_id
       and merchant_domain.allow_redirect = true
       and merchant_domain.verified_at is not null
      left join app.media_assets media on media.id = recommendation.image_asset_id
      left join lateral (
        select
          discount.id,
          discount.code,
          discount.label,
          discount.expires_at,
          discount.last_verified_at,
          case
            when discount.verification_status = 'creator_confirmed'
              and discount.last_verified_at < statement_timestamp() - interval '30 days'
              then 'stale'
            else discount.verification_status
          end as verification_status
        from app.recommendation_discount_codes placement
        join app.discount_codes discount on discount.id = placement.code_id
        where placement.recommendation_id = recommendation.id
          and discount.lifecycle_status = 'published'
          and discount.deleted_at is null
          and (
            discount.verification_status in ('staff_confirmed', 'merchant_verified')
            or (
              discount.verification_status = 'creator_confirmed'
              and discount.last_verified_at >= statement_timestamp() - interval '30 days'
            )
          )
          and (discount.starts_at is null or discount.starts_at <= statement_timestamp())
          and (discount.expires_at is null or discount.expires_at > statement_timestamp())
        order by placement.position, discount.id
        limit 1
      ) placed_discount on true
      where saved.user_id = ${userId}
        and product.status = 'active'
        and brand.status = 'active'
        and category.is_active = true
        and offer.status = 'active'
        and merchant.status = 'active'
        and (
          recommendation.image_asset_id is null
          or media.status = 'ready'
        )
        and (
          ${cursor?.id ?? null}::uuid is null
          or saved.created_at < ${cursor?.timestamp ?? null}::timestamptz
          or (
            saved.created_at = ${cursor?.timestamp ?? null}::timestamptz
            and saved.product_id < ${cursor?.id ?? null}::uuid
          )
        )
      order by saved.created_at desc, saved.product_id desc
      limit ${limit + 1}
    `;
    return mapPage(
      rows,
      limit,
      'saved-products',
      (row) => row.productId,
      (row) => row.savedAt,
      (row) => ({
        productId: row.productId,
        recommendation: mapRecommendation(row, this.redirectBaseUrl),
        savedAt: row.savedAt,
      }),
    );
  }
}

function mapCreator(row: CreatorRow): CreatorCard {
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

function mapRecommendation(
  row: RecommendationRow,
  redirectBaseUrl: string,
): RecommendationCard {
  return {
    brandName: row.brandName,
    category: { name: row.categoryName, slug: row.categorySlug },
    commercialRelationship: row.commercialRelationship,
    createdAt: row.createdAt,
    discount: row.discountCode
      ? {
          code: row.discountCode,
          expiresAt: row.discountExpiresAt,
          id: row.discountId,
          label: row.discountLabel,
          lastVerifiedAt: row.discountLastVerifiedAt,
          verificationStatus: row.discountVerificationStatus ?? undefined,
        }
      : null,
    id: row.id,
    imageAssetId: row.imageAssetId,
    imageUrl: row.imageUrl,
    lifecycle: row.lifecycle,
    merchantHostname: row.merchantHostname,
    price: { amountMinor: Number(row.priceAmountMinor), currency: 'ILS' },
    productId: row.productId,
    productName: row.productName,
    review: { direction: 'rtl', language: 'he', value: row.reviewHe },
    shopUrl: trackedRedirectUrl(redirectBaseUrl, row.shopPublicId),
    storyClips: [],
    updatedAt: row.updatedAt,
    version: row.version,
    videoUrl: row.videoUrl,
  };
}

function mapPage<Row, Item>(
  rows: Row[],
  limit: number,
  scope: 'followed-creators' | 'saved-products',
  id: (row: Row) => string,
  timestamp: (row: Row) => string,
  mapper: (row: Row) => Item,
): EngagementPage<Item> {
  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;
  const last = visibleRows.at(-1);
  const lastId = last ? id(last) : null;
  return {
    items: visibleRows.map(mapper),
    nextCursor:
      hasMore && last && lastId
        ? encodeEngagementCursor({ id: lastId, timestamp: timestamp(last) }, scope)
        : null,
  };
}
