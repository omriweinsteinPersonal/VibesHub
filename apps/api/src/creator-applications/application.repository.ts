import { Injectable } from '@nestjs/common';
import type {
  CreatorApplicationInput,
  CreatorApplicationPatch,
  CreatorApplicationReviewInput,
  CreatorApplicationSocialLink,
  CreatorApplicationStatus,
} from '@vibeshub/contracts';

import { Database } from '../database.js';
import type {
  AdminCreatorApplicationRecord,
  CreatorApplicationRecord,
  CreatorApplicationReviewRecord,
} from './application.types.js';

interface ApplicationRow {
  bioText: string | null;
  createdAt: string;
  decidedAt: string | null;
  displayName: string | null;
  id: string;
  primaryCategoryId: string | null;
  requestedHandle: string | null;
  status: CreatorApplicationStatus;
  submittedAt: string | null;
  updatedAt: string;
  userId: string;
  version: number;
}

interface SocialLinkRow {
  followerCount: number | null;
  handle: string | null;
  platform: CreatorApplicationSocialLink['platform'];
  url: string;
}

interface ReviewRow {
  createdAt: string;
  decision: CreatorApplicationReviewRecord['decision'];
  id: string;
  privateNotes: string | null;
  publicMessage: string | null;
  reviewerUserId: string;
}

interface FeedbackRow {
  createdAt: string;
  decision: 'changes_requested' | 'approved' | 'rejected';
  publicMessage: string;
}

export interface ApplicationRepositoryPort {
  approve(
    id: string,
    reviewerUserId: string,
    review: CreatorApplicationReviewInput,
    expectedStatus?: CreatorApplicationStatus,
  ): Promise<void>;
  create(
    userId: string,
    input: CreatorApplicationInput,
  ): Promise<CreatorApplicationRecord>;
  findById(id: string): Promise<CreatorApplicationRecord | null>;
  findCurrent(userId: string): Promise<CreatorApplicationRecord | null>;
  isHandleAvailable(handle: string, excludingApplicationId: string): Promise<boolean>;
  listForReview(): Promise<CreatorApplicationRecord[]>;
  recordReviewAndTransition(
    id: string,
    reviewerUserId: string,
    expectedStatus: CreatorApplicationStatus,
    nextStatus: CreatorApplicationStatus,
    decision: CreatorApplicationReviewRecord['decision'],
    review: CreatorApplicationReviewInput,
  ): Promise<boolean>;
  transitionOwned(
    id: string,
    userId: string,
    expectedStatuses: CreatorApplicationStatus[],
    nextStatus: CreatorApplicationStatus,
  ): Promise<boolean>;
  updateOwned(
    id: string,
    userId: string,
    input: CreatorApplicationPatch,
  ): Promise<CreatorApplicationRecord | null>;
}

@Injectable()
export class ApplicationRepository implements ApplicationRepositoryPort {
  constructor(private readonly database: Database) {}

  async findCurrent(userId: string): Promise<CreatorApplicationRecord | null> {
    const [row] = await this.database.sql<ApplicationRow[]>`${this.applicationSelect()}
      where a.user_id = ${userId}
      order by a.created_at desc
      limit 1
    `;
    return row ? this.hydrate(row) : null;
  }

  async findById(id: string): Promise<CreatorApplicationRecord | null> {
    const [row] = await this.database.sql<ApplicationRow[]>`${this.applicationSelect()}
      where a.id = ${id}
    `;
    return row ? this.hydrate(row) : null;
  }

  async findAdminById(id: string): Promise<AdminCreatorApplicationRecord | null> {
    const application = await this.findById(id);
    if (!application) return null;
    const reviews = await this.database.sql<ReviewRow[]>`
      select
        id,
        reviewer_user_id as "reviewerUserId",
        decision,
        public_message as "publicMessage",
        private_notes as "privateNotes",
        created_at::text as "createdAt"
      from app.creator_application_reviews
      where application_id = ${id}
      order by created_at, id
    `;
    return { ...application, reviews };
  }

  async create(
    userId: string,
    input: CreatorApplicationInput,
  ): Promise<CreatorApplicationRecord> {
    const existing = await this.findCurrent(userId);
    if (existing) return existing;

    const [row] = await this.database.sql<ApplicationRow[]>`
      insert into app.creator_applications (
        user_id, requested_handle, display_name, bio_text, primary_category_id
      ) values (
        ${userId}, ${input.requestedHandle ?? null}, ${input.displayName ?? null},
        ${input.bioText ?? null}, ${input.primaryCategoryId ?? null}
      )
      returning
        id, user_id as "userId", status, requested_handle::text as "requestedHandle",
        display_name as "displayName", bio_text as "bioText",
        primary_category_id as "primaryCategoryId", submitted_at::text as "submittedAt",
        decided_at::text as "decidedAt", created_at::text as "createdAt",
        updated_at::text as "updatedAt", version
    `;
    if (!row) throw new Error('Creator application was not created');
    if (input.socialLinks?.length)
      await this.replaceSocialLinks(row.id, input.socialLinks);
    return (await this.findById(row.id)) ?? this.withRelations(row, []);
  }

  async updateOwned(
    id: string,
    userId: string,
    input: CreatorApplicationPatch,
  ): Promise<CreatorApplicationRecord | null> {
    const [row] = await this.database.sql<ApplicationRow[]>`
      update app.creator_applications
      set
        requested_handle = coalesce(${input.requestedHandle ?? null}, requested_handle),
        display_name = coalesce(${input.displayName ?? null}, display_name),
        bio_text = coalesce(${input.bioText ?? null}, bio_text),
        primary_category_id = coalesce(${input.primaryCategoryId ?? null}, primary_category_id),
        version = version + 1
      where id = ${id}
        and user_id = ${userId}
        and status in ('draft', 'changes_requested')
      returning
        id, user_id as "userId", status, requested_handle::text as "requestedHandle",
        display_name as "displayName", bio_text as "bioText",
        primary_category_id as "primaryCategoryId", submitted_at::text as "submittedAt",
        decided_at::text as "decidedAt", created_at::text as "createdAt",
        updated_at::text as "updatedAt", version
    `;
    if (!row) return null;
    if (input.socialLinks) await this.replaceSocialLinks(id, input.socialLinks);
    return this.findById(id);
  }

  async transitionOwned(
    id: string,
    userId: string,
    expectedStatuses: CreatorApplicationStatus[],
    nextStatus: CreatorApplicationStatus,
  ): Promise<boolean> {
    const rows = await this.database.sql`
      update app.creator_applications
      set
        status = ${nextStatus},
        submitted_at = case when ${nextStatus} = 'submitted' then statement_timestamp() else submitted_at end,
        version = version + 1
      where id = ${id} and user_id = ${userId} and status = any(${expectedStatuses})
      returning id
    `;
    return rows.length === 1;
  }

  async isHandleAvailable(
    handle: string,
    excludingApplicationId: string,
  ): Promise<boolean> {
    const [row] = await this.database.sql<{ available: boolean }[]>`
      select not exists (
        select 1 from app.reserved_handles where handle = ${handle}
        union all
        select 1 from app.creator_profiles where handle = ${handle}
        union all
        select 1 from app.creator_applications
        where requested_handle = ${handle}
          and id <> ${excludingApplicationId}
          and status in ('submitted', 'under_review', 'changes_requested', 'approved')
      ) as available
    `;
    return row?.available ?? false;
  }

  async listForReview(): Promise<CreatorApplicationRecord[]> {
    const rows = await this.database.sql<ApplicationRow[]>`${this.applicationSelect()}
      where a.status in ('submitted', 'under_review')
      order by a.submitted_at asc nulls last, a.id
      limit 100
    `;
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async recordReviewAndTransition(
    id: string,
    reviewerUserId: string,
    expectedStatus: CreatorApplicationStatus,
    nextStatus: CreatorApplicationStatus,
    decision: CreatorApplicationReviewRecord['decision'],
    review: CreatorApplicationReviewInput,
  ): Promise<boolean> {
    return this.database.sql.begin(async (transaction) => {
      const rows = await transaction`
        update app.creator_applications
        set status = ${nextStatus},
            decided_at = case when ${nextStatus} in ('rejected', 'approved') then statement_timestamp() else decided_at end,
            version = version + 1
        where id = ${id} and status = ${expectedStatus}
        returning id
      `;
      if (rows.length !== 1) return false;
      await transaction`
        insert into app.creator_application_reviews (
          application_id, reviewer_user_id, decision, public_message, private_notes
        ) values (
          ${id}, ${reviewerUserId}, ${decision},
          ${review.publicMessage ?? null}, ${review.privateNotes ?? null}
        )
      `;
      await transaction`
        insert into audit.entries (actor_user_id, action, target_type, target_id)
        values (${reviewerUserId}, ${`creator_application.${decision}`}, 'creator_application', ${id})
      `;
      return true;
    });
  }

  async approve(
    id: string,
    reviewerUserId: string,
    review: CreatorApplicationReviewInput,
    expectedStatus: CreatorApplicationStatus = 'under_review',
  ): Promise<void> {
    await this.database.sql.begin(async (transaction) => {
      const [application] = await transaction<ApplicationRow[]>`
        select
          id, user_id as "userId", status, requested_handle::text as "requestedHandle",
          display_name as "displayName", bio_text as "bioText",
          primary_category_id as "primaryCategoryId", submitted_at::text as "submittedAt",
          decided_at::text as "decidedAt", created_at::text as "createdAt",
          updated_at::text as "updatedAt", version
        from app.creator_applications
        where id = ${id}
        for update
      `;
      if (!application || application.status !== expectedStatus) {
        throw new Error('INVALID_APPLICATION_STATE');
      }
      if (
        !application.requestedHandle ||
        !application.displayName ||
        !application.bioText ||
        !application.primaryCategoryId
      ) {
        throw new Error('INCOMPLETE_APPLICATION');
      }

      const [creator] = await transaction<{ id: string }[]>`
        insert into app.creator_profiles (
          user_id, application_id, handle, display_name, bio_he, bio_locale,
          primary_category_id, status, published_at
        ) values (
          ${application.userId}, ${id}, ${application.requestedHandle},
          ${application.displayName}, ${application.bioText}, 'he',
          ${application.primaryCategoryId}, 'approved', statement_timestamp()
        )
        returning id
      `;
      if (!creator) throw new Error('Creator profile was not created');

      await transaction`
        insert into app.creator_categories (creator_id, category_id, sort_order)
        values (${creator.id}, ${application.primaryCategoryId}, 0)
        on conflict do nothing
      `;
      await transaction`
        insert into app.user_capabilities (user_id, capability, granted_by)
        values
          (${application.userId}, 'creator:manage_profile', ${reviewerUserId}),
          (${application.userId}, 'creator:manage_content', ${reviewerUserId}),
          (${application.userId}, 'creator:view_analytics', ${reviewerUserId})
        on conflict do nothing
      `;
      await transaction`
        update app.creator_applications
        set status = 'approved',
            submitted_at = coalesce(submitted_at, statement_timestamp()),
            decided_at = statement_timestamp(),
            version = version + 1
        where id = ${id}
      `;
      await transaction`
        insert into app.creator_application_reviews (
          application_id, reviewer_user_id, decision, public_message, private_notes
        ) values (
          ${id}, ${reviewerUserId}, 'approved',
          ${review.publicMessage ?? null}, ${review.privateNotes ?? null}
        )
      `;
      await transaction`
        insert into audit.entries (actor_user_id, action, target_type, target_id)
        values (${reviewerUserId}, 'creator_application.approved', 'creator_application', ${id})
      `;
      await transaction`
        insert into ops.outbox_events (
          aggregate_type, aggregate_id, event_type, payload, idempotency_key
        ) values (
          'creator_application', ${id}, 'creator_application.approved.v1',
          ${JSON.stringify({ creatorId: creator.id, userId: application.userId })}::jsonb,
          ${`creator-application-approved:${id}`}
        )
      `;
    });
  }

  private applicationSelect() {
    return this.database.sql`
      select
        a.id, a.user_id as "userId", a.status,
        a.requested_handle::text as "requestedHandle", a.display_name as "displayName",
        a.bio_text as "bioText", a.primary_category_id as "primaryCategoryId",
        a.submitted_at::text as "submittedAt", a.decided_at::text as "decidedAt",
        a.created_at::text as "createdAt", a.updated_at::text as "updatedAt", a.version
      from app.creator_applications a
    `;
  }

  private async hydrate(row: ApplicationRow): Promise<CreatorApplicationRecord> {
    const [links, feedback] = await Promise.all([
      this.database.sql<SocialLinkRow[]>`
        select
          platform, url, handle, follower_count as "followerCount"
        from app.creator_application_social_links
        where application_id = ${row.id}
        order by position, id
      `,
      this.database.sql<FeedbackRow[]>`
        select
          decision, public_message as "publicMessage", created_at::text as "createdAt"
        from app.creator_application_reviews
        where application_id = ${row.id}
          and public_message is not null
          and decision in ('changes_requested', 'approved', 'rejected')
        order by created_at, id
      `,
    ]);
    return this.withRelations(row, links, feedback);
  }

  private withRelations(
    row: ApplicationRow,
    socialLinks: CreatorApplicationSocialLink[],
    feedback: FeedbackRow[] = [],
  ): CreatorApplicationRecord {
    return { ...row, feedback, socialLinks };
  }

  private async replaceSocialLinks(
    applicationId: string,
    links: CreatorApplicationSocialLink[],
  ): Promise<void> {
    await this.database.sql.begin(async (transaction) => {
      await transaction`delete from app.creator_application_social_links where application_id = ${applicationId}`;
      for (const [position, link] of links.entries()) {
        await transaction`
          insert into app.creator_application_social_links (
            application_id, platform, url, handle, follower_count, position
          ) values (
            ${applicationId}, ${link.platform}, ${link.url}, ${link.handle ?? null},
            ${link.followerCount ?? null}, ${position}
          )
        `;
      }
    });
  }
}
