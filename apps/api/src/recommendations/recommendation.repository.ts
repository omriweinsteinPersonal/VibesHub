import { Injectable } from '@nestjs/common';
import type { CreatorRecommendationInput, RecommendationCard } from '@vibeshub/contracts';

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
  discountLabel: string | null;
  id: string;
  imageAssetId: string | null;
  imageUrl: string;
  lifecycle: RecommendationCard['lifecycle'];
  merchantHostname: string;
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
      const creator = await this.findCreator(sql, userId);
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
          commercial_relationship
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
          ${input.commercialRelationship}
        )
        returning id
      `;
      if (!inserted) return null;
      await this.insertAffiliateLink(sql, inserted.id, catalog);
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
          or recommendation.created_at < ${cursor?.timestamp ?? null}::timestamptz
          or (
            recommendation.created_at = ${cursor?.timestamp ?? null}::timestamptz
            and recommendation.id < ${cursor?.id ?? null}::uuid
          )
        )
      order by recommendation.created_at desc, recommendation.id desc
      limit ${limit + 1}
    `;
    return mapCreatorPage(rows, limit, 'creator', this.redirectBaseUrl, 'createdAt');
  }

  async listPublished(
    creatorId: string,
    handle: string,
    limit: number,
    cursor: RecommendationCursor | null,
  ): Promise<RecommendationPage> {
    const rows = await this.database.sql<RecommendationRow[]>`
      ${this.recommendationSelect()}
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
          or recommendation.published_at < ${cursor?.timestamp ?? null}::timestamptz
          or (
            recommendation.published_at = ${cursor?.timestamp ?? null}::timestamptz
            and recommendation.id < ${cursor?.id ?? null}::uuid
          )
        )
      order by recommendation.published_at desc, recommendation.id desc
      limit ${limit + 1}
    `;
    return mapPublicPage(
      rows,
      limit,
      `storefront:${handle}`,
      this.redirectBaseUrl,
      'publishedAt',
    );
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

  private async findCreator(
    sql: DatabaseClient,
    userId: string,
  ): Promise<CreatorIdRow | null> {
    const [creator] = await sql<CreatorIdRow[]>`
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

  private recommendationSelect() {
    return this.database.sql`
      select
        recommendation.id,
        recommendation.image_asset_id as "imageAssetId",
        coalesce(media.public_url, recommendation.image_url) as "imageUrl",
        recommendation.review_he as "reviewHe",
        recommendation.video_url as "videoUrl",
        recommendation.discount_code as "discountCode",
        recommendation.discount_label as "discountLabel",
        recommendation.commercial_relationship as "commercialRelationship",
        recommendation.lifecycle,
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
       and affiliate_link.status <> 'archived'
      join app.merchant_domains merchant_domain
        on merchant_domain.id = affiliate_link.merchant_domain_id
       and merchant_domain.merchant_id = affiliate_link.merchant_id
      left join app.media_assets media on media.id = recommendation.image_asset_id
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
      destinationUrl,
      merchantDomainId: merchantDomain.id,
      merchantId: merchant.id,
      offerId: offer.id,
      productId: product.id,
    };
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
  timestampField: 'createdAt' | 'publishedAt',
): CreatorRecommendationPage {
  return mapPage(rows, limit, scope, timestampField, (row) =>
    mapCreatorRecommendation(row, redirectBaseUrl),
  );
}

function mapPublicPage(
  rows: RecommendationRow[],
  limit: number,
  scope: string,
  redirectBaseUrl: string,
  timestampField: 'createdAt' | 'publishedAt',
): RecommendationPage {
  return mapPage(rows, limit, scope, timestampField, (row) =>
    mapRecommendationCard(row, redirectBaseUrl),
  );
}

function mapPage<T>(
  rows: RecommendationRow[],
  limit: number,
  scope: string,
  timestampField: 'createdAt' | 'publishedAt',
  mapper: (row: RecommendationRow) => T,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;
  const last = visibleRows.at(-1);
  const timestamp = last?.[timestampField];
  return {
    items: visibleRows.map(mapper),
    nextCursor:
      hasMore && last && timestamp
        ? encodeRecommendationCursor({ id: last.id, timestamp }, scope)
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
      ? { code: row.discountCode, label: row.discountLabel }
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
