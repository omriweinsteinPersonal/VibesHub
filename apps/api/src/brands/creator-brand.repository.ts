import { Injectable } from '@nestjs/common';
import type { CreatorBrand, CreatorBrandInput } from '@vibeshub/contracts';

import { Database, type DatabaseClient } from '../database.js';
import { catalogSlug, normalizeCatalogName } from '../recommendations/recommendation.js';

@Injectable()
export class CreatorBrandRepository {
  constructor(private readonly database: Database) {}

  async list(userId: string): Promise<CreatorBrand[] | null> {
    const creatorId = await this.creatorId(this.database.sql, userId);
    if (!creatorId) return null;
    return this.rows(this.database.sql, creatorId);
  }

  async create(userId: string, input: CreatorBrandInput): Promise<CreatorBrand | null> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const creatorId = await this.creatorId(sql, userId);
      if (!creatorId) return null;
      const identity = normalizeCatalogName(input.name);
      const [brand] = await sql<{ id: string }[]>`
        insert into app.brands (slug, name, normalized_name, website_url, created_by_user_id)
        values (${catalogSlug(input.name, identity)}, ${input.name}, ${identity}, ${input.websiteUrl}, ${userId})
        on conflict (normalized_name) do update set
          name = excluded.name,
          website_url = coalesce(app.brands.website_url, excluded.website_url)
        returning id
      `;
      if (!brand) throw new Error('Brand upsert did not return an identity');
      const [created] = await sql<{ id: string }[]>`
        insert into app.creator_brands (creator_id, brand_id, display_name, website_url, position)
        values (${creatorId}, ${brand.id}, ${input.name}, ${input.websiteUrl},
          (select coalesce(max(position), -1) + 1 from app.creator_brands where creator_id = ${creatorId}))
        on conflict (creator_id, brand_id) do update set display_name = excluded.display_name, website_url = excluded.website_url, lifecycle = 'active', version = app.creator_brands.version + 1
        returning id
      `;
      return created
        ? ((await this.rows(sql, creatorId)).find(({ id }) => id === created.id) ?? null)
        : null;
    });
  }

  async update(
    id: string,
    userId: string,
    expectedVersion: number,
    input: CreatorBrandInput,
  ): Promise<CreatorBrand | null> {
    const creatorId = await this.creatorId(this.database.sql, userId);
    if (!creatorId) return null;
    const [updated] = await this.database.sql<{ id: string }[]>`
      update app.creator_brands creator_brand set display_name = ${input.name}, website_url = ${input.websiteUrl}, version = version + 1
      where creator_brand.id = ${id} and creator_brand.creator_id = ${creatorId}
        and creator_brand.version = ${expectedVersion} and creator_brand.lifecycle = 'active'
      returning creator_brand.id
    `;
    if (!updated) return null;
    return (
      (await this.rows(this.database.sql, creatorId)).find((brand) => brand.id === id) ??
      null
    );
  }

  async archive(
    id: string,
    userId: string,
    expectedVersion: number,
    archiveRecommendations: boolean,
  ): Promise<boolean> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const creatorId = await this.creatorId(sql, userId);
      if (!creatorId) return false;
      const [updated] = await sql<{ brandId: string }[]>`
        update app.creator_brands set lifecycle = 'archived', version = version + 1
        where id = ${id} and creator_id = ${creatorId} and version = ${expectedVersion} and lifecycle = 'active'
        returning brand_id as "brandId"
      `;
      if (!updated) return false;
      if (archiveRecommendations) {
        await sql`
          update app.recommendations recommendation
          set lifecycle = 'archived', published_at = null, version = version + 1
          from app.products product
          where recommendation.product_id = product.id
            and recommendation.creator_id = ${creatorId}
            and product.brand_id = ${updated.brandId}
            and recommendation.lifecycle <> 'archived'
            and recommendation.deleted_at is null
        `;
      }
      return true;
    });
  }

  private async creatorId(sql: DatabaseClient, userId: string) {
    const [creator] = await sql<
      { id: string }[]
    >`select id from app.creator_profiles where user_id = ${userId} and status = 'approved' and published_at is not null`;
    return creator?.id ?? null;
  }

  private rows(sql: DatabaseClient, creatorId: string) {
    return sql<CreatorBrand[]>`
      select creator_brand.id, creator_brand.brand_id as "brandId", coalesce(creator_brand.display_name, brand.name) as name,
        creator_brand.website_url as "websiteUrl", creator_brand.version,
        (select count(*)::integer from app.recommendations recommendation join app.products product on product.id = recommendation.product_id where recommendation.creator_id = ${creatorId} and product.brand_id = brand.id and recommendation.lifecycle <> 'archived' and recommendation.deleted_at is null) as "itemCount",
        (select count(*)::integer from app.creator_curated_sections section where section.creator_id = ${creatorId} and section.brand_id = brand.id and section.kind = 'collection') as "collectionCount"
      from app.creator_brands creator_brand join app.brands brand on brand.id = creator_brand.brand_id
      where creator_brand.creator_id = ${creatorId} and creator_brand.lifecycle = 'active'
      order by creator_brand.position, creator_brand.id
    `;
  }
}
