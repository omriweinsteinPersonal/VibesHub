import { Injectable } from '@nestjs/common';
import type {
  CreatorDiscountCode,
  CreatorDiscountCodeInput,
  DiscountCodeLifecycle,
  DiscountCodeVerificationStatus,
  PublicDiscountCode,
} from '@vibeshub/contracts';

import { Database, type DatabaseClient } from '../database.js';
import { validateRedirectDestination } from '../redirects/redirect-destination.js';
import { catalogSlug } from '../recommendations/recommendation.js';

interface DiscountCodeRow {
  code: string;
  detailsHe: string | null;
  expiresAt: string | null;
  id: string;
  label: string | null;
  lastVerifiedAt: string | null;
  lifecycle: DiscountCodeLifecycle;
  merchantHostname: string;
  merchantName: string;
  merchantUrl: string;
  startsAt: string | null;
  updatedAt: string;
  verificationStatus: DiscountCodeVerificationStatus;
  version: number;
}

interface CreatorIdentity {
  id: string;
  userId: string;
}

@Injectable()
export class DiscountCodeRepository {
  constructor(private readonly database: Database) {}

  async create(
    userId: string,
    input: CreatorDiscountCodeInput,
  ): Promise<CreatorDiscountCode | null> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const creator = await this.findCreator(sql, userId, true);
      if (!creator) return null;
      const merchantId = await this.upsertMerchant(sql, input.merchantUrl);
      const [inserted] = await sql<{ id: string }[]>`
        insert into app.discount_codes (
          creator_id,
          merchant_id,
          code,
          label,
          details_text,
          starts_at,
          expires_at
        ) values (
          ${creator.id},
          ${merchantId},
          ${input.code},
          ${input.label},
          ${input.detailsHe},
          ${input.startsAt},
          ${input.expiresAt}
        )
        returning id
      `;
      return inserted ? this.findOwnedWithSql(sql, inserted.id, userId) : null;
    });
  }

  async listOwned(userId: string): Promise<CreatorDiscountCode[] | null> {
    const creator = await this.findCreator(this.database.sql, userId);
    if (!creator) return null;
    const rows = await this.database.sql<DiscountCodeRow[]>`
      ${this.discountSelect()}
      where code.creator_id = ${creator.id}
        and code.deleted_at is null
      order by
        (code.lifecycle_status = 'archived')::integer,
        code.updated_at desc,
        code.id desc
      limit 100
    `;
    return rows.map(mapCreatorDiscountCode);
  }

  findOwned(id: string, userId: string): Promise<CreatorDiscountCode | null> {
    return this.findOwnedWithSql(this.database.sql, id, userId);
  }

  async replaceOwned(
    id: string,
    userId: string,
    expectedVersion: number,
    input: CreatorDiscountCodeInput,
  ): Promise<CreatorDiscountCode | null> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const creator = await this.findCreator(sql, userId, true);
      if (!creator) return null;
      const merchantId = await this.upsertMerchant(sql, input.merchantUrl);
      const [updated] = await sql<{ id: string }[]>`
        update app.discount_codes
        set
          merchant_id = ${merchantId},
          code = ${input.code},
          label = ${input.label},
          details_text = ${input.detailsHe},
          starts_at = ${input.startsAt},
          expires_at = ${input.expiresAt},
          verification_status = 'unverified',
          last_verified_at = null,
          lifecycle_status = case
            when lifecycle_status = 'published' then 'draft'
            else lifecycle_status
          end,
          version = version + 1
        where id = ${id}
          and creator_id = ${creator.id}
          and version = ${expectedVersion}
          and lifecycle_status <> 'archived'
          and deleted_at is null
        returning id
      `;
      return updated ? this.findOwnedWithSql(sql, updated.id, userId) : null;
    });
  }

  transitionOwned(
    id: string,
    userId: string,
    expectedVersion: number,
    lifecycle: 'archived' | 'hidden',
  ): Promise<CreatorDiscountCode | null> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const creator = await this.findCreator(sql, userId, true);
      if (!creator) return null;
      const [updated] = await sql<{ id: string }[]>`
        update app.discount_codes
        set lifecycle_status = ${lifecycle}, version = version + 1
        where id = ${id}
          and creator_id = ${creator.id}
          and version = ${expectedVersion}
          and lifecycle_status <> 'archived'
          and deleted_at is null
        returning id
      `;
      return updated ? this.findOwnedWithSql(sql, updated.id, userId) : null;
    });
  }

  confirmOwned(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<CreatorDiscountCode | null> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const creator = await this.findCreator(sql, userId, true);
      if (!creator) return null;
      const [updated] = await sql<{ id: string }[]>`
        update app.discount_codes
        set
          verification_status = 'creator_confirmed',
          last_verified_at = statement_timestamp(),
          lifecycle_status = 'published',
          version = version + 1
        where id = ${id}
          and creator_id = ${creator.id}
          and version = ${expectedVersion}
          and lifecycle_status <> 'archived'
          and deleted_at is null
          and (expires_at is null or expires_at > statement_timestamp())
        returning id
      `;
      if (!updated) return null;
      await sql`
        insert into app.discount_code_verifications (
          code_id,
          method,
          result,
          checked_by_user_id,
          evidence
        ) values (
          ${updated.id},
          'creator_confirmation',
          'valid',
          ${creator.userId},
          jsonb_build_object('source', 'creator_dashboard')
        )
      `;
      return this.findOwnedWithSql(sql, updated.id, userId);
    });
  }

  async listPublished(creatorId: string): Promise<PublicDiscountCode[]> {
    const rows = await this.database.sql<DiscountCodeRow[]>`
      ${this.discountSelect()}
      where code.creator_id = ${creatorId}
        and code.lifecycle_status = 'published'
        and code.deleted_at is null
        and (
          code.verification_status in ('staff_confirmed', 'merchant_verified')
          or (
            code.verification_status = 'creator_confirmed'
            and code.last_verified_at >= statement_timestamp() - interval '30 days'
          )
        )
        and (code.starts_at is null or code.starts_at <= statement_timestamp())
        and (code.expires_at is null or code.expires_at > statement_timestamp())
        and merchant.status = 'active'
      order by code.updated_at desc, code.id desc
      limit 50
    `;
    return rows.map(mapPublicDiscountCode);
  }

  private async findCreator(
    sql: DatabaseClient,
    userId: string,
    lock = false,
  ): Promise<CreatorIdentity | null> {
    const [creator] = lock
      ? await sql<CreatorIdentity[]>`
          select id, user_id as "userId"
          from app.creator_profiles
          where user_id = ${userId}
            and status = 'approved'
            and published_at is not null
          for update
        `
      : await sql<CreatorIdentity[]>`
          select id, user_id as "userId"
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
  ): Promise<CreatorDiscountCode | null> {
    const [row] = await sql<DiscountCodeRow[]>`
      ${this.discountSelect()}
      join app.creator_profiles creator on creator.id = code.creator_id
      where code.id = ${id}
        and creator.user_id = ${userId}
        and code.deleted_at is null
    `;
    return row ? mapCreatorDiscountCode(row) : null;
  }

  private discountSelect() {
    return this.database.sql`
      select
        code.id,
        code.code::text as code,
        code.label,
        code.details_text as "detailsHe",
        code.starts_at as "startsAt",
        code.expires_at as "expiresAt",
        case
          when code.verification_status = 'creator_confirmed'
            and code.last_verified_at < statement_timestamp() - interval '30 days'
            then 'stale'
          else code.verification_status
        end as "verificationStatus",
        code.last_verified_at as "lastVerifiedAt",
        code.lifecycle_status as lifecycle,
        code.updated_at as "updatedAt",
        code.version,
        merchant.name as "merchantName",
        merchant.hostname::text as "merchantHostname",
        merchant.homepage_url as "merchantUrl"
      from app.discount_codes code
      join app.merchants merchant on merchant.id = code.merchant_id
    `;
  }

  private async upsertMerchant(
    sql: DatabaseClient,
    merchantUrl: string,
  ): Promise<string> {
    const destination = validateRedirectDestination(merchantUrl);
    const origin = new URL(destination.destinationUrl).origin;
    const [merchant] = await sql<{ id: string }[]>`
      insert into app.merchants (slug, name, hostname, homepage_url)
      values (
        ${catalogSlug(destination.hostname.replaceAll('.', '-'), destination.hostname)},
        ${destination.hostname},
        ${destination.hostname},
        ${origin}
      )
      on conflict (hostname) do update
      set homepage_url = excluded.homepage_url
      returning id
    `;
    if (!merchant) throw new Error('Merchant upsert did not return an identity');
    await sql`
      insert into app.merchant_domains (merchant_id, hostname)
      values (${merchant.id}, ${destination.hostname})
      on conflict (hostname) do nothing
    `;
    return merchant.id;
  }
}

function mapPublicDiscountCode(row: DiscountCodeRow): PublicDiscountCode {
  return {
    code: row.code,
    details: row.detailsHe
      ? { direction: 'rtl', language: 'he', value: row.detailsHe }
      : null,
    expiresAt: row.expiresAt,
    id: row.id,
    label: row.label,
    lastVerifiedAt: row.lastVerifiedAt,
    merchantHostname: row.merchantHostname,
    merchantName: row.merchantName,
    startsAt: row.startsAt,
    verificationStatus: row.verificationStatus,
  };
}

function mapCreatorDiscountCode(row: DiscountCodeRow): CreatorDiscountCode {
  return {
    ...mapPublicDiscountCode(row),
    lifecycle: row.lifecycle,
    merchantUrl: row.merchantUrl,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}
