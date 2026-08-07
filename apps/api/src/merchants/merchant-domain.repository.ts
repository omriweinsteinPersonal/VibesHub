import { Injectable } from '@nestjs/common';
import type {
  MerchantDomainApprovalInput,
  MerchantDomainQueueQuery,
  MerchantDomainReasonInput,
  MerchantDomainReviewItem,
  MerchantDomainReviewStatus,
} from '@vibeshub/contracts';

import { Database, type DatabaseClient } from '../database.js';
import type { MerchantDomainQueueCursor } from './merchant-domain.js';

interface MerchantDomainRow {
  allowImport: boolean;
  allowRedirect: boolean;
  createdAt: string;
  creatorCount: number;
  hostname: string;
  id: string;
  latestRecommendationAt: string | null;
  merchantHomepageUrl: string;
  merchantId: string;
  merchantName: string;
  merchantStatus: 'active' | 'inactive';
  recommendationCount: number;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewNote: string | null;
  reviewStatus: MerchantDomainReviewStatus;
  updatedAt: string;
  verifiedAt: string | null;
  version: number;
}

export type MerchantDomainTransitionResult =
  | { kind: 'changed' }
  | { kind: 'invalid_state'; status: MerchantDomainReviewStatus }
  | { actualVersion: number; kind: 'version_conflict' }
  | { kind: 'not_found' };

export interface MerchantDomainRepositoryPort {
  approve(
    id: string,
    actorUserId: string,
    expectedVersion: number,
    input: MerchantDomainApprovalInput,
  ): Promise<MerchantDomainTransitionResult>;
  disable(
    id: string,
    actorUserId: string,
    expectedVersion: number,
    input: MerchantDomainReasonInput,
  ): Promise<MerchantDomainTransitionResult>;
  findById(id: string): Promise<MerchantDomainReviewItem | null>;
  list(
    query: MerchantDomainQueueQuery,
    cursor: MerchantDomainQueueCursor | null,
  ): Promise<{
    items: MerchantDomainReviewItem[];
    nextCursor: MerchantDomainQueueCursor | null;
  }>;
  reject(
    id: string,
    actorUserId: string,
    expectedVersion: number,
    input: MerchantDomainReasonInput,
  ): Promise<MerchantDomainTransitionResult>;
}

@Injectable()
export class MerchantDomainRepository implements MerchantDomainRepositoryPort {
  constructor(private readonly database: Database) {}

  async list(
    query: MerchantDomainQueueQuery,
    cursor: MerchantDomainQueueCursor | null,
  ): Promise<{
    items: MerchantDomainReviewItem[];
    nextCursor: MerchantDomainQueueCursor | null;
  }> {
    const sql = this.database.sql;
    const cursorFilter = cursor
      ? sql`and (domain.created_at, domain.id) > (${cursor.createdAt}, ${cursor.id})`
      : sql``;
    const rows = await sql<MerchantDomainRow[]>`
      with queue as (
        select domain.*
        from app.merchant_domains domain
        where domain.review_status = ${query.status}
          ${cursorFilter}
        order by domain.created_at, domain.id
        limit ${query.limit + 1}
      )
      select
        domain.id,
        domain.hostname::text as hostname,
        domain.review_status as "reviewStatus",
        domain.allow_import as "allowImport",
        domain.allow_redirect as "allowRedirect",
        domain.verified_at::text as "verifiedAt",
        domain.reviewed_by_user_id as "reviewedByUserId",
        domain.reviewed_at::text as "reviewedAt",
        domain.review_note as "reviewNote",
        domain.created_at::text as "createdAt",
        domain.updated_at::text as "updatedAt",
        domain.version,
        merchant.id as "merchantId",
        merchant.name as "merchantName",
        merchant.homepage_url as "merchantHomepageUrl",
        merchant.status as "merchantStatus",
        coalesce(stats.recommendation_count, 0)::integer as "recommendationCount",
        coalesce(stats.creator_count, 0)::integer as "creatorCount",
        stats.latest_recommendation_at::text as "latestRecommendationAt"
      from queue domain
      join app.merchants merchant on merchant.id = domain.merchant_id
      left join lateral (
        select
          count(distinct link.recommendation_id)::integer as recommendation_count,
          count(distinct recommendation.creator_id)::integer as creator_count,
          max(recommendation.created_at) as latest_recommendation_at
        from app.affiliate_links link
        join app.recommendations recommendation
          on recommendation.id = link.recommendation_id
        where link.merchant_domain_id = domain.id
          and link.status <> 'archived'
          and recommendation.deleted_at is null
          and recommendation.lifecycle <> 'archived'
      ) stats on true
      order by domain.created_at, domain.id
    `;
    const hasMore = rows.length > query.limit;
    const pageRows = rows.slice(0, query.limit);
    const last = pageRows.at(-1);
    return {
      items: pageRows.map((row) => this.hydrate(row)),
      nextCursor:
        hasMore && last
          ? { createdAt: last.createdAt, id: last.id, status: query.status }
          : null,
    };
  }

  async findById(id: string): Promise<MerchantDomainReviewItem | null> {
    const [row] = await this.database.sql<MerchantDomainRow[]>`${this.selectItem()}
      where domain.id = ${id}
    `;
    return row ? this.hydrate(row) : null;
  }

  approve(
    id: string,
    actorUserId: string,
    expectedVersion: number,
    input: MerchantDomainApprovalInput,
  ): Promise<MerchantDomainTransitionResult> {
    return this.transition(
      id,
      actorUserId,
      expectedVersion,
      ['pending', 'rejected', 'disabled'],
      'approved',
      input.allowImport,
      input.allowRedirect,
      input.note ?? null,
    );
  }

  reject(
    id: string,
    actorUserId: string,
    expectedVersion: number,
    input: MerchantDomainReasonInput,
  ): Promise<MerchantDomainTransitionResult> {
    return this.transition(
      id,
      actorUserId,
      expectedVersion,
      ['pending'],
      'rejected',
      false,
      false,
      input.note,
    );
  }

  disable(
    id: string,
    actorUserId: string,
    expectedVersion: number,
    input: MerchantDomainReasonInput,
  ): Promise<MerchantDomainTransitionResult> {
    return this.transition(
      id,
      actorUserId,
      expectedVersion,
      ['approved'],
      'disabled',
      false,
      false,
      input.note,
    );
  }

  private async transition(
    id: string,
    actorUserId: string,
    expectedVersion: number,
    allowedStatuses: MerchantDomainReviewStatus[],
    nextStatus: Exclude<MerchantDomainReviewStatus, 'pending'>,
    allowImport: boolean,
    allowRedirect: boolean,
    note: string | null,
  ): Promise<MerchantDomainTransitionResult> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const [current] = await sql<
        { reviewStatus: MerchantDomainReviewStatus; version: number }[]
      >`
        select review_status as "reviewStatus", version
        from app.merchant_domains
        where id = ${id}
        for update
      `;
      if (!current) return { kind: 'not_found' };
      if (current.version !== expectedVersion) {
        return { actualVersion: current.version, kind: 'version_conflict' };
      }
      if (!allowedStatuses.includes(current.reviewStatus)) {
        return { kind: 'invalid_state', status: current.reviewStatus };
      }

      await sql`
        update app.merchant_domains
        set
          review_status = ${nextStatus},
          allow_import = ${allowImport},
          allow_redirect = ${allowRedirect},
          verified_at = case
            when ${nextStatus} = 'approved' then statement_timestamp()
            when ${nextStatus} = 'rejected' then null
            else verified_at
          end,
          reviewed_by_user_id = ${actorUserId},
          reviewed_at = statement_timestamp(),
          review_note = ${note},
          version = version + 1
        where id = ${id}
      `;
      await sql`
        insert into audit.entries (
          actor_user_id,
          action,
          target_type,
          target_id,
          metadata
        ) values (
          ${actorUserId},
          ${`merchant_domain.${nextStatus}`},
          'merchant_domain',
          ${id},
          ${JSON.stringify({
            allowImport,
            allowRedirect,
            from: current.reviewStatus,
            note,
            to: nextStatus,
          })}::jsonb
        )
      `;
      return { kind: 'changed' };
    });
  }

  private selectItem() {
    return this.database.sql`
      select
        domain.id,
        domain.hostname::text as hostname,
        domain.review_status as "reviewStatus",
        domain.allow_import as "allowImport",
        domain.allow_redirect as "allowRedirect",
        domain.verified_at::text as "verifiedAt",
        domain.reviewed_by_user_id as "reviewedByUserId",
        domain.reviewed_at::text as "reviewedAt",
        domain.review_note as "reviewNote",
        domain.created_at::text as "createdAt",
        domain.updated_at::text as "updatedAt",
        domain.version,
        merchant.id as "merchantId",
        merchant.name as "merchantName",
        merchant.homepage_url as "merchantHomepageUrl",
        merchant.status as "merchantStatus",
        coalesce(stats.recommendation_count, 0)::integer as "recommendationCount",
        coalesce(stats.creator_count, 0)::integer as "creatorCount",
        stats.latest_recommendation_at::text as "latestRecommendationAt"
      from app.merchant_domains domain
      join app.merchants merchant on merchant.id = domain.merchant_id
      left join lateral (
        select
          count(distinct link.recommendation_id)::integer as recommendation_count,
          count(distinct recommendation.creator_id)::integer as creator_count,
          max(recommendation.created_at) as latest_recommendation_at
        from app.affiliate_links link
        join app.recommendations recommendation
          on recommendation.id = link.recommendation_id
        where link.merchant_domain_id = domain.id
          and link.status <> 'archived'
          and recommendation.deleted_at is null
          and recommendation.lifecycle <> 'archived'
      ) stats on true
    `;
  }

  private hydrate(row: MerchantDomainRow): MerchantDomainReviewItem {
    return {
      allowImport: row.allowImport,
      allowRedirect: row.allowRedirect,
      createdAt: row.createdAt,
      creatorCount: row.creatorCount,
      hostname: row.hostname,
      id: row.id,
      latestRecommendationAt: row.latestRecommendationAt,
      merchant: {
        homepageUrl: row.merchantHomepageUrl,
        id: row.merchantId,
        name: row.merchantName,
        status: row.merchantStatus,
      },
      recommendationCount: row.recommendationCount,
      reviewedAt: row.reviewedAt,
      reviewedByUserId: row.reviewedByUserId,
      reviewNote: row.reviewNote,
      reviewStatus: row.reviewStatus,
      updatedAt: row.updatedAt,
      verifiedAt: row.verifiedAt,
      version: row.version,
    };
  }
}
