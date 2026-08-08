import { Injectable } from '@nestjs/common';
import type {
  CreatorRecommendationInput,
  DiscountCodeVerificationStatus,
  RecommendationCard,
} from '@vibeshub/contracts';

import { parseApiConfig } from '../config.js';
import { Database, type DatabaseClient } from '../database.js';
import {
  trackedRedirectUrl,
  validateRedirectDestination,
} from '../redirects/redirect-destination.js';
import {
  catalogSlug,
  encodeRecommendationCursor,
  normalizeCatalogName,
  type RecommendationCursor,
} from './recommendation.js';

interface CatalogIdRow {
  id: string;
}

interface CreatorIdRow {
  id: string;
}

interface OfferIdRow {
  id: string;
  productId: string;
}

interface CatalogIdentity {
  brandId: string;
  destinationUrl: string;
  merchantDomainId: string;
  merchantId: string;
  offerId: string;
  productId: string;
}

interface RecommendationImageSource {
  assetId: string | null;
  publicUrl: string;
}

interface RecommendationRow {
  brandName: string;
  categoryId: string;
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
  position: number;
  publishedAt: string | null;
  priceAmountMinor: string;
  productId: string;
  productName: string;
  productUrl: string;
  reviewHe: string;
  shopPublicId: string;
  updatedAt: string;
  version: number;
  videoUrl: string | null;
}

export interface CreatorRecommendationRecord extends RecommendationCard {
  categoryId: string;
  position: number;
  productUrl: string;
}

export interface RecommendationPage {
  items: RecommendationCard[];
  nextCursor: string | null;
}

export interface CreatorRecommendationPage {
  items: CreatorRecommendationRecord[];
  nextCursor: string | null;
}

@Injectable()
export class RecommendationRepository {
  private readonly redirectBaseUrl = parseApiConfig(process.env).redirectBaseUrl;

  constructor(private readonly database: Database) {}

  async create(
    userId: string,
    input: CreatorRecommendationInput,
  ): Promise<CreatorRecommendationRecord | null> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const creator = await this.findCreator(sql, userId, true);
      if (!creator) return null;
      const image = await this.resolveImageSource(sql, userId, input);
      const catalog = await this.upsertCatalog(sql, userId, input, image);
      const [inserted] = await sql<{ id: string }[]>`
        insert into app.recommendations (
          creator_id,
          product_id,
          offer_id,
          image_asset_id,
          image_url,
          review_he,
          video_url,
          discount_code,
          discount_label,
          commercial_relationship,
          position
        ) values (
          ${creator.id},
          ${catalog.productId},
          ${catalog.offerId},
          ${image.assetId},
          ${image.assetId ? null : image.publicUrl},
          ${input.reviewHe},
          ${input.videoUrl ?? null},
          ${input.discountCode?.toUpperCase() ?? null},
          ${input.discountLabel ?? null},
          ${input.commercialRelationship},
          (
            select coalesce(max(existing.position), -1) + 1
            from app.recommendations existing
            where existing.creator_id = ${creator.id}
              and existing.lifecycle <> 'archived'
              and existing.deleted_at is null
          )
        )
        returning id
      `;
      if (!inserted) return null;
      await this.insertAffiliateLink(sql, inserted.id, catalog);
      await this.syncDiscountPlacement(
        sql,
        inserted.id,
        creator.id,
        catalog,
        input.discountCode ?? null,
        input.discountLabel ?? null,
      );
      return this.findOwnedWithSql(sql, inserted.id, userId);
    });
  }

  findOwned(id: string, userId: string): Promise<CreatorRecommendationRecord | null> {
    return this.findOwnedWithSql(this.database.sql, id, userId);
  }

  async listOwned(
    userId: string,
    limit: number,
    cursor: RecommendationCursor | null,
  ): Promise<CreatorRecommendationPage | null> {
    const creator = await this.findCreator(this.database.sql, userId);
    if (!creator) return null;
    const rows = await this.database.sql<RecommendationRow[]>`
      ${this.recommendationSelect()}
      where recommendation.creator_id = ${creator.id}
        and recommendation.deleted_at is null
        and (
          ${cursor?.id ?? null}::uuid is null
          or (recommendation.lifecycle = 'archived')::integer
            > ${cursor?.archived ? 1 : 0}
          or (
            (recommendation.lifecycle = 'archived') = ${cursor?.archived ?? false}
            and recommendation.position > ${cursor?.position ?? 0}
          )
          or (
            (recommendation.lifecycle = 'archived') = ${cursor?.archived ?? false}
            and recommendation.position = ${cursor?.position ?? 0}
            and recommendation.id > ${cursor?.id ?? null}::uuid
          )
        )
      order by
        (recommendation.lifecycle = 'archived')::integer,
        recommendation.position,
        recommendation.id
      limit ${limit + 1}
    `;
    return mapCreatorPage(rows, limit, 'creator', this.redirectBaseUrl);
  }

  async listPublished(
    creatorId: string,
    handle: string,
    limit: number,
    cursor: RecommendationCursor | null,
  ): Promise<RecommendationPage> {
    const rows = await this.database.sql<RecommendationRow[]>`
      ${this.recommendationSelect(true)}
      where recommendation.creator_id = ${creatorId}
        and recommendation.lifecycle = 'published'
        and recommendation.deleted_at is null
        and brand.status = 'active'
        and merchant.status = 'active'
        and category.is_active = true
        and product.status = 'active'
        and offer.status = 'active'
        and affiliate_link.status = 'active'
        and merchant_domain.allow_redirect = true
        and merchant_domain.verified_at is not null
        and (
          recommendation.image_asset_id is null
          or media.status = 'ready'
        )
        and (
          ${cursor?.id ?? null}::uuid is null
          or recommendation.position > ${cursor?.position ?? 0}
          or (
            recommendation.position = ${cursor?.position ?? 0}
            and recommendation.id > ${cursor?.id ?? null}::uuid
          )
        )
      order by recommendation.position, recommendation.id
      limit ${limit + 1}
    `;
    return mapPublicPage(rows, limit, `storefront:${handle}`, this.redirectBaseUrl);
  }

  async replaceOwned(
    id: string,
    userId: string,
    expectedVersion: number,
    input: CreatorRecommendationInput,
  ): Promise<CreatorRecommendationRecord | null> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const creator = await this.findCreator(sql, userId);
      if (!creator) return null;
      const image = await this.resolveImageSource(sql, userId, input);
      const catalog = await this.upsertCatalog(sql, userId, input, image);
      const [updated] = await sql<{ id: string; lifecycle: string }[]>`
        update app.recommendations
        set
          product_id = ${catalog.productId},
          offer_id = ${catalog.offerId},
          image_asset_id = ${image.assetId},
          image_url = ${image.assetId ? null : image.publicUrl},
          review_he = ${input.reviewHe},
          video_url = ${input.videoUrl ?? null},
          discount_code = ${input.discountCode?.toUpperCase() ?? null},
          discount_label = ${input.discountLabel ?? null},
          commercial_relationship = ${input.commercialRelationship},
          version = version + 1
        where id = ${id}
          and creator_id = ${creator.id}
          and version = ${expectedVersion}
          and lifecycle <> 'archived'
          and deleted_at is null
        returning id, lifecycle
      `;
      if (!updated) return null;
      const [link] = await sql<{ id: string }[]>`
        update app.affiliate_links affiliate_link
        set
          offer_id = ${catalog.offerId},
          merchant_domain_id = ${catalog.merchantDomainId},
          merchant_id = ${catalog.merchantId},
          destination_url = ${catalog.destinationUrl},
          status = case
            when ${updated.lifecycle} = 'published'
              and merchant_domain.allow_redirect = true
              and merchant_domain.verified_at is not null
              then 'active'
            else 'blocked'
          end,
          version = affiliate_link.version + 1
        from app.merchant_domains merchant_domain
        where affiliate_link.recommendation_id = ${updated.id}
          and affiliate_link.status <> 'archived'
          and merchant_domain.id = ${catalog.merchantDomainId}
        returning affiliate_link.id
      `;
      if (!link) throw new Error('AFFILIATE_LINK_MISSING');
      if (updated.lifecycle === 'published') {
        const [active] = await sql<{ id: string }[]>`
          select id from app.affiliate_links
          where id = ${link.id} and status = 'active'
        `;
        if (!active) throw new Error('MERCHANT_DOMAIN_NOT_APPROVED');
      }
      await this.syncDiscountPlacement(
        sql,
        updated.id,
        creator.id,
        catalog,
        input.discountCode ?? null,
        input.discountLabel ?? null,
      );
      return this.findOwnedWithSql(sql, updated.id, userId);
    });
  }

  async transitionOwned(
    id: string,
    userId: string,
    expectedVersion: number,
    lifecycle: 'draft' | 'published',
  ): Promise<CreatorRecommendationRecord | null> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const [target] = await sql<{ id: string }[]>`
        select recommendation.id
        from app.recommendations recommendation
        join app.creator_profiles creator on creator.id = recommendation.creator_id
        where recommendation.id = ${id}
          and creator.user_id = ${userId}
          and recommendation.version = ${expectedVersion}
          and recommendation.lifecycle <> 'archived'
          and recommendation.deleted_at is null
        for update of recommendation
      `;
      if (!target) return null;

      if (lifecycle === 'published') {
        const [link] = await sql<{ id: string }[]>`
          update app.affiliate_links affiliate_link
          set status = 'active', version = affiliate_link.version + 1
          from app.merchant_domains merchant_domain
          where affiliate_link.recommendation_id = ${id}
            and affiliate_link.status = 'blocked'
            and merchant_domain.id = affiliate_link.merchant_domain_id
            and merchant_domain.allow_redirect = true
            and merchant_domain.verified_at is not null
          returning affiliate_link.id
        `;
        if (!link) throw new Error('MERCHANT_DOMAIN_NOT_APPROVED');
      }

      const [updated] = await sql<{ id: string }[]>`
        update app.recommendations
        set
          lifecycle = ${lifecycle},
          published_at = case
            when ${lifecycle} = 'published' then statement_timestamp()
            else null
          end,
          version = version + 1
        where id = ${id}
        returning id
      `;
      if (!updated) return null;

      if (lifecycle === 'published') {
        const confirmedCodes = await sql<{ id: string }[]>`
          update app.discount_codes discount
          set
            lifecycle_status = 'published',
            verification_status = 'creator_confirmed',
            last_verified_at = statement_timestamp(),
            version = discount.version + 1
          from app.recommendation_discount_codes placement
          where placement.recommendation_id = ${id}
            and discount.id = placement.code_id
            and discount.lifecycle_status <> 'archived'
            and discount.verification_status in ('unverified', 'failed', 'stale')
            and (discount.expires_at is null or discount.expires_at > statement_timestamp())
          returning discount.id
        `;
        for (const confirmedCode of confirmedCodes) {
          await sql`
            insert into app.discount_code_verifications (
              code_id,
              method,
              result,
              checked_by_user_id,
              evidence
            )
            select
              ${confirmedCode.id},
              'creator_confirmation',
              'valid',
              creator.user_id,
              jsonb_build_object('source', 'recommendation_publish')
            from app.creator_profiles creator
            where creator.id = (
              select recommendation.creator_id
              from app.recommendations recommendation
              where recommendation.id = ${id}
            )
          `;
        }
      }

      if (lifecycle === 'draft') {
        await sql`
          update app.affiliate_links
          set status = 'blocked', version = version + 1
          where recommendation_id = ${id}
            and status in ('active', 'unhealthy')
        `;
      }
      return this.findOwnedWithSql(sql, updated.id, userId);
    });
  }

  async archiveOwned(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<CreatorRecommendationRecord | null> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const creator = await this.findCreator(sql, userId, true);
      if (!creator) return null;
      const [updated] = await sql<{ id: string }[]>`
        update app.recommendations
        set
          lifecycle = 'archived',
          published_at = null,
          version = version + 1
        where id = ${id}
          and creator_id = ${creator.id}
          and version = ${expectedVersion}
          and lifecycle <> 'archived'
          and deleted_at is null
        returning id
      `;
      if (!updated) return null;
      await sql`
        update app.affiliate_links
        set status = 'archived', version = version + 1
        where recommendation_id = ${id}
          and status <> 'archived'
      `;
      return this.findOwnedWithSql(sql, updated.id, userId);
    });
  }

  async restoreOwned(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<CreatorRecommendationRecord | null> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const creator = await this.findCreator(sql, userId, true);
      if (!creator) return null;
      const [updated] = await sql<{ id: string }[]>`
        update app.recommendations recommendation
        set
          lifecycle = 'draft',
          position = (
            select coalesce(max(existing.position), -1) + 1
            from app.recommendations existing
            where existing.creator_id = ${creator.id}
              and existing.lifecycle <> 'archived'
              and existing.deleted_at is null
          ),
          version = recommendation.version + 1
        where recommendation.id = ${id}
          and recommendation.creator_id = ${creator.id}
          and recommendation.version = ${expectedVersion}
          and recommendation.lifecycle = 'archived'
          and recommendation.deleted_at is null
        returning recommendation.id
      `;
      if (!updated) return null;
      const [link] = await sql<{ id: string }[]>`
        update app.affiliate_links
        set status = 'blocked', version = version + 1
        where recommendation_id = ${id}
          and status = 'archived'
        returning id
      `;
      if (!link) throw new Error('AFFILIATE_LINK_MISSING');
      return this.findOwnedWithSql(sql, updated.id, userId);
    });
  }

  async moveOwned(
    id: string,
    userId: string,
    expectedVersion: number,
    direction: 'up' | 'down',
  ): Promise<CreatorRecommendationRecord | null> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const creator = await this.findCreator(sql, userId, true);
      if (!creator) return null;
      const [current] = await sql<{ id: string; position: number }[]>`
        select id, position
        from app.recommendations
        where id = ${id}
          and creator_id = ${creator.id}
          and version = ${expectedVersion}
          and lifecycle <> 'archived'
          and deleted_at is null
        for update
      `;
      if (!current) return null;

      const [neighbor] =
        direction === 'up'
          ? await sql<{ id: string; position: number }[]>`
              select id, position
              from app.recommendations
              where creator_id = ${creator.id}
                and lifecycle <> 'archived'
                and deleted_at is null
                and (
                  position < ${current.position}
                  or (position = ${current.position} and id < ${current.id})
                )
              order by position desc, id desc
              limit 1
              for update
            `
          : await sql<{ id: string; position: number }[]>`
              select id, position
              from app.recommendations
              where creator_id = ${creator.id}
                and lifecycle <> 'archived'
                and deleted_at is null
                and (
                  position > ${current.position}
                  or (position = ${current.position} and id > ${current.id})
                )
              order by position, id
              limit 1
              for update
            `;
      if (!neighbor) return this.findOwnedWithSql(sql, current.id, userId);

      await sql`
        update app.recommendations
        set
          position = case
            when id = ${current.id} then ${neighbor.position}
            else ${current.position}
          end,
          version = version + 1
        where id in (${current.id}, ${neighbor.id})
      `;
      return this.findOwnedWithSql(sql, current.id, userId);
    });
  }

  private async findCreator(
    sql: DatabaseClient,
    userId: string,
    lock = false,
  ): Promise<CreatorIdRow | null> {
    const [creator] = lock
      ? await sql<CreatorIdRow[]>`
          select id
          from app.creator_profiles
          where user_id = ${userId}
            and status = 'approved'
            and published_at is not null
          for update
        `
      : await sql<CreatorIdRow[]>`
          select id
          from app.creator_profiles
          where user_id = ${userId}
            and status = 'approved'
            and published_at is not null
        `;
    return creator ?? null;
  }

  private async findOwnedWithSql(
    sql: DatabaseClient,
    id: string,
    userId: string,
  ): Promise<CreatorRecommendationRecord | null> {
    const [row] = await sql<RecommendationRow[]>`
      ${this.recommendationSelect()}
      join app.creator_profiles creator on creator.id = recommendation.creator_id
      where recommendation.id = ${id}
        and creator.user_id = ${userId}
        and recommendation.deleted_at is null
    `;
    return row ? mapCreatorRecommendation(row, this.redirectBaseUrl) : null;
  }

  private recommendationSelect(publicProjection = false) {
    return this.database.sql`
      select
        recommendation.id,
        recommendation.image_asset_id as "imageAssetId",
        coalesce(media.public_url, recommendation.image_url) as "imageUrl",
        recommendation.review_he as "reviewHe",
        recommendation.video_url as "videoUrl",
        case
          when ${publicProjection} then placed_discount.code::text
          else coalesce(placed_discount.code::text, recommendation.discount_code)
        end as "discountCode",
        placed_discount.id as "discountId",
        case
          when ${publicProjection} then placed_discount.label
          else coalesce(placed_discount.label, recommendation.discount_label)
        end as "discountLabel",
        placed_discount.expires_at as "discountExpiresAt",
        placed_discount.last_verified_at as "discountLastVerifiedAt",
        placed_discount.verification_status as "discountVerificationStatus",
        recommendation.commercial_relationship as "commercialRelationship",
        recommendation.lifecycle,
        recommendation.position,
        recommendation.published_at as "publishedAt",
        recommendation.version,
        recommendation.created_at as "createdAt",
        recommendation.updated_at as "updatedAt",
        product.name as "productName",
        product.id as "productId",
        brand.name as "brandName",
        category.id as "categoryId",
        category.slug::text as "categorySlug",
        category.name_en as "categoryName",
        merchant_domain.hostname::text as "merchantHostname",
        affiliate_link.public_id::text as "shopPublicId",
        affiliate_link.destination_url as "productUrl",
        offer.price_amount_minor::text as "priceAmountMinor"
      from app.recommendations recommendation
      join app.products product on product.id = recommendation.product_id
      join app.brands brand on brand.id = product.brand_id
      join app.categories category on category.id = product.primary_category_id
      join app.product_offers offer on offer.id = recommendation.offer_id
      join app.merchants merchant on merchant.id = offer.merchant_id
      join app.affiliate_links affiliate_link
        on affiliate_link.recommendation_id = recommendation.id
      join app.merchant_domains merchant_domain
        on merchant_domain.id = affiliate_link.merchant_domain_id
       and merchant_domain.merchant_id = affiliate_link.merchant_id
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
          and discount.deleted_at is null
          and (
            ${publicProjection} = false
            or (
              discount.lifecycle_status = 'published'
              and (
                discount.verification_status in ('staff_confirmed', 'merchant_verified')
                or (
                  discount.verification_status = 'creator_confirmed'
                  and discount.last_verified_at >= statement_timestamp() - interval '30 days'
                )
              )
              and (discount.starts_at is null or discount.starts_at <= statement_timestamp())
              and (discount.expires_at is null or discount.expires_at > statement_timestamp())
            )
          )
        order by placement.position, discount.id
        limit 1
      ) placed_discount on true
    `;
  }

  private async upsertCatalog(
    sql: DatabaseClient,
    userId: string,
    input: CreatorRecommendationInput,
    image: RecommendationImageSource,
  ): Promise<CatalogIdentity> {
    const brandIdentity = normalizeCatalogName(input.brandName);
    const [brand] = await sql<CatalogIdRow[]>`
      insert into app.brands (slug, name, normalized_name, created_by_user_id)
      values (
        ${catalogSlug(input.brandName, brandIdentity)},
        ${input.brandName},
        ${brandIdentity},
        ${userId}
      )
      on conflict (normalized_name) do update
      set name = excluded.name
      returning id
    `;
    if (!brand) throw new Error('Brand upsert did not return an identity');

    const productIdentity = normalizeCatalogName(input.productName);
    const productSlug = catalogSlug(
      `${input.brandName}-${input.productName}`,
      `${brandIdentity}:${productIdentity}`,
    );
    const [product] = await sql<CatalogIdRow[]>`
      insert into app.products (
        slug,
        brand_id,
        primary_category_id,
        name,
        normalized_name,
        primary_image_asset_id,
        primary_image_url,
        created_by_user_id
      ) values (
        ${productSlug},
        ${brand.id},
        ${input.categoryId},
        ${input.productName},
        ${productIdentity},
        ${image.assetId},
        ${image.assetId ? null : image.publicUrl},
        ${userId}
      )
      on conflict (brand_id, normalized_name) do update
      set name = excluded.name
      returning id
    `;
    if (!product) throw new Error('Product upsert did not return an identity');

    const destination = validateRedirectDestination(input.productUrl);
    const destinationUrl = destination.destinationUrl;
    const hostname = destination.hostname;
    const [merchant] = await sql<CatalogIdRow[]>`
      insert into app.merchants (slug, name, hostname, homepage_url)
      values (
        ${catalogSlug(hostname.replaceAll('.', '-'), hostname)},
        ${hostname},
        ${hostname},
        ${new URL(destinationUrl).origin}
      )
      on conflict (hostname) do update
      set homepage_url = excluded.homepage_url
      returning id
    `;
    if (!merchant) throw new Error('Merchant upsert did not return an identity');

    const [offer] = await sql<OfferIdRow[]>`
      insert into app.product_offers (
        product_id,
        merchant_id,
        destination_url,
        price_amount_minor
      ) values (
        ${product.id},
        ${merchant.id},
        ${destinationUrl},
        ${input.priceAmountMinor}
      )
      on conflict (destination_url_hash) do update
      set
        merchant_id = excluded.merchant_id,
        price_amount_minor = excluded.price_amount_minor,
        observed_at = statement_timestamp(),
        version = app.product_offers.version + 1
      returning id, product_id as "productId"
    `;
    if (!offer) throw new Error('Offer upsert did not return an identity');
    if (offer.productId !== product.id) {
      throw new Error('OFFER_PRODUCT_IDENTITY_CONFLICT');
    }
    const [merchantDomain] = await sql<CatalogIdRow[]>`
      insert into app.merchant_domains (merchant_id, hostname)
      values (${merchant.id}, ${hostname})
      on conflict (hostname) do update
      set merchant_id = app.merchant_domains.merchant_id
      where app.merchant_domains.merchant_id = excluded.merchant_id
      returning id
    `;
    if (!merchantDomain) throw new Error('MERCHANT_DOMAIN_CONFLICT');
    return {
      brandId: brand.id,
      destinationUrl,
      merchantDomainId: merchantDomain.id,
      merchantId: merchant.id,
      offerId: offer.id,
      productId: product.id,
    };
  }

  private async syncDiscountPlacement(
    sql: DatabaseClient,
    recommendationId: string,
    creatorId: string,
    catalog: CatalogIdentity,
    discountCode: string | null,
    discountLabel: string | null,
  ): Promise<void> {
    await sql`
      delete from app.recommendation_discount_codes
      where recommendation_id = ${recommendationId}
    `;
    if (!discountCode) return;

    const [code] = await sql<{ id: string }[]>`
      insert into app.discount_codes (
        creator_id,
        merchant_id,
        brand_id,
        code,
        label,
        lifecycle_status
      ) values (
        ${creatorId},
        ${catalog.merchantId},
        ${catalog.brandId},
        ${discountCode.toUpperCase()},
        ${discountLabel},
        'draft'
      )
      on conflict (creator_id, merchant_id, code)
        where deleted_at is null and lifecycle_status <> 'archived'
      do update set
        brand_id = excluded.brand_id,
        label = excluded.label
      returning id
    `;
    if (!code) throw new Error('Discount code upsert did not return an identity');
    await sql`
      insert into app.recommendation_discount_codes (
        recommendation_id,
        code_id,
        position
      ) values (${recommendationId}, ${code.id}, 0)
    `;
  }

  private async insertAffiliateLink(
    sql: DatabaseClient,
    recommendationId: string,
    catalog: CatalogIdentity,
  ): Promise<void> {
    await sql`
      insert into app.affiliate_links (
        recommendation_id,
        offer_id,
        merchant_domain_id,
        merchant_id,
        destination_url,
        status
      ) values (
        ${recommendationId},
        ${catalog.offerId},
        ${catalog.merchantDomainId},
        ${catalog.merchantId},
        ${catalog.destinationUrl},
        'blocked'
      )
    `;
  }

  private async resolveImageSource(
    sql: DatabaseClient,
    userId: string,
    input: CreatorRecommendationInput,
  ): Promise<RecommendationImageSource> {
    if (!input.imageAssetId) {
      if (!input.imageUrl) throw new Error('RECOMMENDATION_IMAGE_REQUIRED');
      return { assetId: null, publicUrl: input.imageUrl };
    }
    const [asset] = await sql<{ id: string; publicUrl: string }[]>`
      select id, public_url as "publicUrl"
      from app.media_assets
      where id = ${input.imageAssetId}
        and owner_user_id = ${userId}
        and media_kind = 'recommendation_image'
        and status = 'ready'
        and deleted_at is null
    `;
    if (!asset) throw new Error('MEDIA_ASSET_NOT_READY_OR_OWNED');
    return { assetId: asset.id, publicUrl: asset.publicUrl };
  }
}

function mapCreatorPage(
  rows: RecommendationRow[],
  limit: number,
  scope: string,
  redirectBaseUrl: string,
): CreatorRecommendationPage {
  return mapPage(rows, limit, scope, (row) =>
    mapCreatorRecommendation(row, redirectBaseUrl),
  );
}

function mapPublicPage(
  rows: RecommendationRow[],
  limit: number,
  scope: string,
  redirectBaseUrl: string,
): RecommendationPage {
  return mapPage(rows, limit, scope, (row) =>
    mapRecommendationCard(row, redirectBaseUrl),
  );
}

function mapPage<T>(
  rows: RecommendationRow[],
  limit: number,
  scope: string,
  mapper: (row: RecommendationRow) => T,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;
  const last = visibleRows.at(-1);
  return {
    items: visibleRows.map(mapper),
    nextCursor:
      hasMore && last
        ? encodeRecommendationCursor(
            {
              archived: last.lifecycle === 'archived',
              id: last.id,
              position: last.position,
            },
            scope,
          )
        : null,
  };
}

function mapCreatorRecommendation(
  row: RecommendationRow,
  redirectBaseUrl: string,
): CreatorRecommendationRecord {
  return {
    ...mapRecommendationCard(row, redirectBaseUrl),
    categoryId: row.categoryId,
    position: row.position,
    productUrl: row.productUrl,
  };
}

function mapRecommendationCard(
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
    updatedAt: row.updatedAt,
    version: row.version,
    videoUrl: row.videoUrl,
  };
}
