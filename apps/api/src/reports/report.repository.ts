import { Injectable } from '@nestjs/common';
import type { ContentReportInput, ContentReportReceipt } from '@vibeshub/contracts';

import { Database } from '../database.js';

@Injectable()
export class ReportRepository {
  constructor(private readonly database: Database) {}

  async create(input: ContentReportInput): Promise<ContentReportReceipt | null> {
    const creatorId = input.targetType === 'creator' ? input.targetId : null;
    const recommendationId =
      input.targetType === 'recommendation' ? input.targetId : null;

    const [report] = await this.database.sql<ContentReportReceipt[]>`
      with valid_target as (
        select
          ${creatorId}::uuid as creator_id,
          ${recommendationId}::uuid as recommendation_id
        where (
          ${creatorId}::uuid is not null
          and exists (
            select 1
            from app.creator_profiles creator
            where creator.id = ${creatorId}::uuid
              and creator.status = 'approved'
              and creator.published_at is not null
          )
        ) or (
          ${recommendationId}::uuid is not null
          and exists (
            select 1
            from app.recommendations recommendation
            join app.creator_profiles creator
              on creator.id = recommendation.creator_id
            where recommendation.id = ${recommendationId}::uuid
              and recommendation.lifecycle = 'published'
              and recommendation.deleted_at is null
              and creator.status = 'approved'
              and creator.published_at is not null
          )
        )
      )
      insert into app.content_reports (
        reporter_installation_id,
        target_creator_id,
        target_recommendation_id,
        reason_code,
        details
      )
      select
        ${input.installationId}::uuid,
        valid_target.creator_id,
        valid_target.recommendation_id,
        ${input.reason},
        ${input.details ?? null}
      from valid_target
      on conflict (reporter_installation_id, target_fingerprint)
        where status in ('received', 'reviewing')
      do update set
        reason_code = excluded.reason_code,
        details = coalesce(excluded.details, app.content_reports.details)
      returning id, status
    `;
    return report ?? null;
  }
}
