import { Injectable } from '@nestjs/common';
import type {
  CreatorDiscountCode,
  CreatorDiscountCodeInput,
  StoryClipInput,
  DiscountCodeLifecycle,
  DiscountCodeVerificationStatus,
  PublicDiscountCode,
} from '@vibeshub/contracts';

import { Database, type DatabaseClient } from '../database.js';
import { validateRedirectDestination } from '../redirects/redirect-destination.js';
import { catalogSlug } from '../recommendations/recommendation.js';

interface DiscountCodeRow {
  brandId: string | null;
  code: string | null;
  detailsHe: string | null;
  discountAmountMinor: number | null;
  discountPercent: number | null;
  storyClips: PublicDiscountCode['storyClips'];
  expiresAt: string | null;
  id: string;
  label: string | null;
  lastVerifiedAt: string | null;
  lifecycle: DiscountCodeLifecycle;
  merchantHostname: string;
  merchantName: string;
  merchantUrl: string;
  offerType: 'brand_promotion' | 'creator_code';
  priority: number;
  recurrenceRule: 'month_end_week' | 'none';
  scopeId: string | null;
  scopeKind: 'brand' | 'collection' | 'item';
  source: 'external' | 'manual';
  stackable: boolean;
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
      if (!(await this.offerTargetsBelongToCreator(sql, creator.id, input))) return null;
      const merchantId = await this.upsertMerchant(sql, input.merchantUrl);
      const [inserted] = await sql<{ id: string }[]>`
        insert into app.discount_codes (
          creator_id,
          merchant_id,
          creator_brand_id,
          destination_url,
          code,
          label,
          details_text,
          details_locale,
          discount_amount_minor,
          starts_at,
          expires_at,
          offer_type,
          discount_percent,
          scope_kind,
          scope_id,
          priority,
          stackable,
          recurrence_rule,
          source
        ) values (
          ${creator.id},
          ${merchantId},
          ${input.brandId},
          ${input.merchantUrl},
          ${input.code},
          ${input.label},
          ${input.detailsHe},
          ${input.detailsHe && /[א-ת]/u.test(input.detailsHe) ? 'he' : 'en'},
          ${input.discountAmountMinor},
          ${input.startsAt},
          ${input.expiresAt},
          ${input.offerType},
          ${input.discountPercent},
          ${input.scopeKind},
          ${input.scopeId},
          ${input.priority},
          ${input.stackable},
          ${input.recurrenceRule},
          ${input.source}
        )
        returning id
      `;
      if (!inserted) return null;
      await this.syncStoryClips(sql, inserted.id, userId, input.storyClips);
      return this.findOwnedWithSql(sql, inserted.id, userId);
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
      if (!(await this.offerTargetsBelongToCreator(sql, creator.id, input))) return null;
      const merchantId = await this.upsertMerchant(sql, input.merchantUrl);
      const [updated] = await sql<{ id: string }[]>`
        update app.discount_codes
        set
          merchant_id = ${merchantId},
          creator_brand_id = ${input.brandId},
          destination_url = ${input.merchantUrl},
          code = ${input.code},
          label = ${input.label},
          details_text = ${input.detailsHe},
          details_locale = ${input.detailsHe && /[א-ת]/u.test(input.detailsHe) ? 'he' : 'en'},
          discount_amount_minor = ${input.discountAmountMinor},
          starts_at = ${input.startsAt},
          expires_at = ${input.expiresAt},
          offer_type = ${input.offerType},
          discount_percent = ${input.discountPercent},
          scope_kind = ${input.scopeKind},
          scope_id = ${input.scopeId},
          priority = ${input.priority},
          stackable = ${input.stackable},
          recurrence_rule = ${input.recurrenceRule},
          source = ${input.source},
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
      if (!updated) return null;
      await this.syncStoryClips(sql, updated.id, userId, input.storyClips);
      return this.findOwnedWithSql(sql, updated.id, userId);
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
        and (
          code.recurrence_rule = 'none'
          or (
            code.recurrence_rule = 'month_end_week'
            and current_date >= (date_trunc('month', current_date) + interval '1 month - 7 days')::date
          )
        )
        and merchant.status = 'active'
      order by code.priority desc, code.updated_at desc, code.id desc
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
          for update
        `
      : await sql<CreatorIdentity[]>`
          select id, user_id as "userId"
          from app.creator_profiles
          where user_id = ${userId}
            and status = 'approved'
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
        code.creator_brand_id as "brandId",
        code.label,
        code.details_text as "detailsHe",
        code.discount_amount_minor as "discountAmountMinor",
        code.discount_percent as "discountPercent",
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', clip.id,
            'mediaAssetId', clip.media_asset_id,
            'position', clip.position,
            'url', coalesce(media.public_url, clip.video_url)
          ) order by clip.position)
          from app.discount_code_story_clips clip
          left join app.media_assets media on media.id = clip.media_asset_id and media.status = 'ready'
          where clip.code_id = code.id and coalesce(media.public_url, clip.video_url) is not null
        ), '[]'::jsonb) as "storyClips",
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
        code.offer_type as "offerType",
        code.priority,
        code.recurrence_rule as "recurrenceRule",
        code.scope_id as "scopeId",
        code.scope_kind as "scopeKind",
        code.source,
        code.stackable,
        merchant.name as "merchantName",
        merchant.hostname::text as "merchantHostname",
        coalesce(code.destination_url, merchant.homepage_url) as "merchantUrl"
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

  private async syncStoryClips(
    sql: DatabaseClient,
    codeId: string,
    userId: string,
    clips: StoryClipInput[],
  ): Promise<void> {
    await sql`delete from app.discount_code_story_clips where code_id = ${codeId}`;
    for (const [position, clip] of clips.entries()) {
      if (clip.mediaAssetId) {
        const [asset] = await sql<{ id: string }[]>`
          select id from app.media_assets
          where id = ${clip.mediaAssetId} and owner_user_id = ${userId}
            and media_kind = 'story_video' and status = 'ready' and deleted_at is null
        `;
        if (!asset) throw new Error('STORY_MEDIA_ASSET_NOT_READY_OR_OWNED');
      }
      await sql`
        insert into app.discount_code_story_clips (code_id, position, media_asset_id, video_url)
        values (${codeId}, ${position}, ${clip.mediaAssetId ?? null}, ${clip.videoUrl ?? null})
      `;
    }
  }

  private async offerTargetsBelongToCreator(
    sql: DatabaseClient,
    creatorId: string,
    input: CreatorDiscountCodeInput,
  ): Promise<boolean> {
    if (input.brandId) {
      const [brand] = await sql<{ exists: boolean }[]>`
        select true as exists from app.creator_brands
        where id = ${input.brandId} and creator_id = ${creatorId} and lifecycle = 'active'
      `;
      if (!brand) return false;
    }
    if (input.scopeKind === 'brand') return input.scopeId === null;
    if (!input.scopeId) return false;
    if (input.scopeKind === 'item') {
      const [item] = await sql<{ exists: boolean }[]>`
        select true as exists from app.recommendations
        where id = ${input.scopeId} and creator_id = ${creatorId} and deleted_at is null
      `;
      return Boolean(item);
    }
    const [collection] = await sql<{ exists: boolean }[]>`
      select true as exists from app.creator_curated_sections
      where id = ${input.scopeId} and creator_id = ${creatorId} and kind = 'collection'
    `;
    return Boolean(collection);
  }
}

function mapPublicDiscountCode(row: DiscountCodeRow): PublicDiscountCode {
  return {
    brandId: row.brandId,
    code: row.code,
    details: row.detailsHe
      ? {
          direction: /[א-ת]/u.test(row.detailsHe) ? 'rtl' : 'ltr',
          language: /[א-ת]/u.test(row.detailsHe) ? 'he' : 'en',
          value: row.detailsHe,
        }
      : null,
    discountAmountMinor: row.discountAmountMinor,
    expiresAt: row.expiresAt,
    discountPercent: row.discountPercent,
    storyClips: row.storyClips,
    id: row.id,
    label: row.label,
    lastVerifiedAt: row.lastVerifiedAt,
    merchantHostname: row.merchantHostname,
    merchantName: row.merchantName,
    merchantUrl: row.merchantUrl,
    offerType: row.offerType,
    priority: row.priority,
    recurrenceRule: row.recurrenceRule,
    scopeId: row.scopeId,
    scopeKind: row.scopeKind,
    source: row.source,
    stackable: row.stackable,
    startsAt: row.startsAt,
    verificationStatus: row.verificationStatus,
  };
}

function mapCreatorDiscountCode(row: DiscountCodeRow): CreatorDiscountCode {
  return {
    ...mapPublicDiscountCode(row),
    lifecycle: row.lifecycle,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}
