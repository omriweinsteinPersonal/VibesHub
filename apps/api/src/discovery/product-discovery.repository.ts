import { Injectable } from '@nestjs/common';
import type {
  DiscoveryRecommendationCard,
  DiscoveryRecommendationQuery,
  DiscountCodeVerificationStatus,
  GlobalSearchQuery,
  GlobalSearchResults,
  RecommendationCard,
} from '@vibeshub/contracts';

import { parseApiConfig } from '../config.js';
import { Database } from '../database.js';
import { trackedRedirectUrl } from '../redirects/redirect-destination.js';
import { CreatorDirectoryRepository } from './creator-directory.repository.js';
import {
  encodeProductDiscoveryCursor,
  type ProductDiscoveryCursor,
} from './product-discovery.js';

interface DiscoveryRecommendationRow {
  brandName: string;
  categoryName: string;
  categorySlug: string;
  commercialRelationship: RecommendationCard['commercialRelationship'];
  createdAt: string;
  creatorDisplayName: string;
  creatorHandle: string;
  creatorId: string;
  creatorIsVerified: boolean;
  discountCode: string | null;
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
  publishedAt: string;
  rank: number;
  reviewHe: string;
  savedCount: number;
  shopPublicId: string;
  updatedAt: string;
  version: number;
  videoUrl: string | null;
}

export interface ProductDiscoveryPage {
  items: DiscoveryRecommendationCard[];
  nextCursor: string | null;
}

@Injectable()
export class ProductDiscoveryRepository {
  private readonly redirectBaseUrl = parseApiConfig(process.env).redirectBaseUrl;

  constructor(
    private readonly database: Database,
    private readonly creators: CreatorDirectoryRepository,
  ) {}

  async list(
    query: DiscoveryRecommendationQuery,
    cursor: ProductDiscoveryCursor | null,
  ): Promise<ProductDiscoveryPage> {
    const searchPattern = query.q ? `%${query.q}%` : null;
    const rows = await this.database.sql<DiscoveryRecommendationRow[]>`
      with ranked_recommendations as (
        select
          recommendation.id,
          recommendation.image_asset_id as "imageAssetId",
          coalesce(media.public_url, recommendation.image_url) as "imageUrl",
          recommendation.review_he as "reviewHe",
          recommendation.video_url as "videoUrl",
          placed_discount.code::text as "discountCode",
          placed_discount.label as "discountLabel",
          placed_discount.expires_at as "discountExpiresAt",
          placed_discount.last_verified_at as "discountLastVerifiedAt",
          placed_discount.verification_status as "discountVerificationStatus",
          recommendation.commercial_relationship as "commercialRelationship",
          recommendation.lifecycle,
          recommendation.created_at as "createdAt",
          recommendation.updated_at as "updatedAt",
          recommendation.published_at as "publishedAt",
          recommendation.version,
          product.id as "productId",
          product.name as "productName",
          brand.name as "brandName",
          category.slug::text as "categorySlug",
          category.name_en as "categoryName",
          creator.id as "creatorId",
          creator.handle::text as "creatorHandle",
          creator.display_name as "creatorDisplayName",
          creator.is_verified as "creatorIsVerified",
          merchant_domain.hostname::text as "merchantHostname",
          affiliate_link.public_id::text as "shopPublicId",
          offer.price_amount_minor::text as "priceAmountMinor",
          saves.total as "savedCount",
          case ${query.sort}
            when 'trending' then saves.recent
            when 'most-saved' then saves.total
            else 0
          end as rank
        from app.recommendations recommendation
        join app.creator_profiles creator on creator.id = recommendation.creator_id
        join app.products product on product.id = recommendation.product_id
        join app.brands brand on brand.id = product.brand_id
        join app.categories category on category.id = product.primary_category_id
        join app.product_offers offer on offer.id = recommendation.offer_id
        join app.merchants merchant on merchant.id = offer.merchant_id
        join app.affiliate_links affiliate_link
          on affiliate_link.recommendation_id = recommendation.id
        join app.merchant_domains merchant_domain
          on merchant_domain.id = affiliate_link.merchant_domain_id
        left join app.media_assets media on media.id = recommendation.image_asset_id
        left join lateral (
          select
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
        left join lateral (
          select
            count(*)::integer as total,
            count(*) filter (
              where saved.created_at >= statement_timestamp() - interval '30 days'
            )::integer as recent
          from app.saved_products saved
          where saved.product_id = product.id
        ) saves on true
        where recommendation.lifecycle = 'published'
          and recommendation.deleted_at is null
          and recommendation.published_at is not null
          and creator.status = 'approved'
          and creator.published_at is not null
          and product.status = 'active'
          and brand.status = 'active'
          and category.is_active = true
          and offer.status = 'active'
          and merchant.status = 'active'
          and affiliate_link.status = 'active'
          and merchant_domain.allow_redirect = true
          and merchant_domain.verified_at is not null
          and (
            recommendation.image_asset_id is null
            or media.status = 'ready'
          )
          and (
            ${query.category ?? null}::text is null
            or category.slug::text = ${query.category ?? null}
          )
          and (
            ${searchPattern}::text is null
            or product.name ilike ${searchPattern}
            or brand.name ilike ${searchPattern}
          )
      )
      select *
      from ranked_recommendations
      where
        ${cursor?.id ?? null}::uuid is null
        or rank < ${cursor?.rank ?? 0}
        or (
          rank = ${cursor?.rank ?? 0}
          and "publishedAt" < ${cursor?.publishedAt ?? null}::timestamptz
        )
        or (
          rank = ${cursor?.rank ?? 0}
          and "publishedAt" = ${cursor?.publishedAt ?? null}::timestamptz
          and id < ${cursor?.id ?? null}::uuid
        )
      order by rank desc, "publishedAt" desc, id desc
      limit ${query.limit + 1}
    `;

    const hasMore = rows.length > query.limit;
    const visibleRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = visibleRows.at(-1);
    return {
      items: visibleRows.map((row) =>
        mapDiscoveryRecommendation(row, this.redirectBaseUrl),
      ),
      nextCursor:
        hasMore && last
          ? encodeProductDiscoveryCursor(
              {
                id: last.id,
                publishedAt: last.publishedAt,
                rank: last.rank,
              },
              query,
            )
          : null,
    };
  }

  async search(query: GlobalSearchQuery): Promise<GlobalSearchResults> {
    const searchPattern = `%${query.q}%`;
    const prefixPattern = `${query.q}%`;
    const [creatorPage, products] = await Promise.all([
      this.creators.list({ limit: query.limit, q: query.q }, null),
      this.database.sql<DiscoveryRecommendationRow[]>`
        with product_candidates as (
          select
            recommendation.id,
            recommendation.image_asset_id as "imageAssetId",
            coalesce(media.public_url, recommendation.image_url) as "imageUrl",
            recommendation.review_he as "reviewHe",
            recommendation.video_url as "videoUrl",
            placed_discount.code::text as "discountCode",
            placed_discount.label as "discountLabel",
            placed_discount.expires_at as "discountExpiresAt",
            placed_discount.last_verified_at as "discountLastVerifiedAt",
            placed_discount.verification_status as "discountVerificationStatus",
            recommendation.commercial_relationship as "commercialRelationship",
            recommendation.lifecycle,
            recommendation.created_at as "createdAt",
            recommendation.updated_at as "updatedAt",
            recommendation.published_at as "publishedAt",
            recommendation.version,
            product.id as "productId",
            product.name as "productName",
            brand.name as "brandName",
            category.slug::text as "categorySlug",
            category.name_en as "categoryName",
            creator.id as "creatorId",
            creator.handle::text as "creatorHandle",
            creator.display_name as "creatorDisplayName",
            creator.is_verified as "creatorIsVerified",
            merchant_domain.hostname::text as "merchantHostname",
            affiliate_link.public_id::text as "shopPublicId",
            offer.price_amount_minor::text as "priceAmountMinor",
            saves.total as "savedCount",
            saves.recent as rank,
            case
              when lower(product.name) = ${query.q}
                or lower(brand.name) = ${query.q} then 0
              when product.name ilike ${prefixPattern}
                or brand.name ilike ${prefixPattern} then 1
              else 2
            end as relevance,
            row_number() over (
              partition by product.id
              order by
                recommendation.published_at desc,
                creator.follower_count desc,
                recommendation.id desc
            ) as product_rank
          from app.recommendations recommendation
          join app.creator_profiles creator on creator.id = recommendation.creator_id
          join app.products product on product.id = recommendation.product_id
          join app.brands brand on brand.id = product.brand_id
          join app.categories category on category.id = product.primary_category_id
          join app.product_offers offer on offer.id = recommendation.offer_id
          join app.merchants merchant on merchant.id = offer.merchant_id
          join app.affiliate_links affiliate_link
            on affiliate_link.recommendation_id = recommendation.id
          join app.merchant_domains merchant_domain
            on merchant_domain.id = affiliate_link.merchant_domain_id
          left join app.media_assets media on media.id = recommendation.image_asset_id
          left join lateral (
            select
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
          left join lateral (
            select
              count(*)::integer as total,
              count(*) filter (
                where saved.created_at >= statement_timestamp() - interval '30 days'
              )::integer as recent
            from app.saved_products saved
            where saved.product_id = product.id
          ) saves on true
          where recommendation.lifecycle = 'published'
            and recommendation.deleted_at is null
            and recommendation.published_at is not null
            and creator.status = 'approved'
            and creator.published_at is not null
            and product.status = 'active'
            and brand.status = 'active'
            and category.is_active = true
            and offer.status = 'active'
            and merchant.status = 'active'
            and affiliate_link.status = 'active'
            and merchant_domain.allow_redirect = true
            and merchant_domain.verified_at is not null
            and (
              recommendation.image_asset_id is null
              or media.status = 'ready'
            )
            and (
              product.name ilike ${searchPattern}
              or brand.name ilike ${searchPattern}
            )
        )
        select *
        from product_candidates
        where product_rank = 1
        order by relevance, "savedCount" desc, "publishedAt" desc, id desc
        limit ${query.limit}
      `,
    ]);

    return {
      creators: creatorPage.items,
      products: products.map((row) =>
        mapDiscoveryRecommendation(row, this.redirectBaseUrl),
      ),
    };
  }
}

function mapDiscoveryRecommendation(
  row: DiscoveryRecommendationRow,
  redirectBaseUrl: string,
): DiscoveryRecommendationCard {
  return {
    brandName: row.brandName,
    category: { name: row.categoryName, slug: row.categorySlug },
    commercialRelationship: row.commercialRelationship,
    createdAt: row.createdAt,
    creator: {
      displayName: row.creatorDisplayName,
      handle: row.creatorHandle,
      id: row.creatorId,
      verificationStatus: row.creatorIsVerified ? 'verified' : 'unverified',
    },
    discount: row.discountCode
      ? {
          code: row.discountCode,
          expiresAt: row.discountExpiresAt,
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
    savedCount: row.savedCount,
    shopUrl: trackedRedirectUrl(redirectBaseUrl, row.shopPublicId),
    updatedAt: row.updatedAt,
    version: row.version,
    videoUrl: row.videoUrl,
  };
}
