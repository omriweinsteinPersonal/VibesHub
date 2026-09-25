import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { ClientAnalyticsEvent } from '@vibeshub/analytics';
import type { CreatorAnalyticsDashboard } from '@vibeshub/contracts';

import { Database, type DatabaseClient } from '../database.js';
import type { ResolvedRedirect } from '../redirects/redirect.repository.js';

type IngestionOutcome = 'accepted' | 'duplicate' | 'rejected';

interface HashIdentity {
  anonymousHash: string;
  keyId: string;
  sessionHash: string;
}

interface MetricRow {
  codeCopies: number;
  date: string;
  instagramTaps: number;
  recommendationViews: number;
  shopClicks: number;
  storyCompletions: number;
  storyOpens: number;
  storefrontViews: number;
  uniqueVisitors: number;
}

interface RecommendationMetricRow {
  categoryName: string;
  categorySlug: string;
  codeCopies: number;
  id: string;
  imageUrl: string | null;
  productName: string;
  shopClicks: number;
  storyCompletions: number;
  storyOpens: number;
  views: number;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly database: Database) {}

  async claimRateLimit(
    sessionId: string,
    networkAddress: string,
    eventCount: number,
  ): Promise<boolean> {
    const [claim] = await this.database.sql<{ allowed: boolean }[]>`
      with active_key as (
        select key_material
        from analytics.identity_hash_keys
        where retired_at is null
        order by created_at desc
        limit 1
      ), identity as (
        select encode(
          extensions.hmac(
            convert_to(${`${sessionId}:${networkAddress}`}, 'UTF8'),
            key_material,
            'sha256'
          ),
          'hex'
        ) as identity_hash
        from active_key
      ), claimed as (
        insert into analytics.ingestion_rate_limits (
          identity_hash,
          window_started_at,
          event_count
        )
        select
          identity_hash,
          date_trunc('minute', statement_timestamp()),
          ${eventCount}
        from identity
        on conflict (identity_hash, window_started_at) do update
        set event_count = analytics.ingestion_rate_limits.event_count + excluded.event_count
        where analytics.ingestion_rate_limits.event_count + excluded.event_count <= 120
        returning 1
      )
      select exists(select 1 from claimed) as allowed
    `;
    return claim?.allowed ?? false;
  }

  ingestClientEvent(event: ClientAnalyticsEvent): Promise<IngestionOutcome> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const identity = await this.hashIdentity(sql, event.anonymousId, event.sessionId);
      const context = await this.validateClientContext(sql, event);
      if (!context) return 'rejected';

      const [receipt] = await sql<{ eventId: string }[]>`
        insert into analytics.event_receipts (event_id, source)
        values (${event.eventId}, ${event.source})
        on conflict (event_id) do nothing
        returning event_id as "eventId"
      `;
      if (!receipt) return 'duplicate';

      const properties =
        event.name === 'story.completed'
          ? { durationMs: event.durationMs, watchedMs: event.watchedMs }
          : {};

      await sql`
        insert into analytics.events (
          id,
          event_name,
          occurred_at,
          source,
          authority,
          hash_key_id,
          anonymous_id_hash,
          session_id_hash,
          creator_id,
          recommendation_id,
          product_id,
          discount_code_id,
          properties
        ) values (
          ${event.eventId},
          ${event.name},
          ${event.occurredAt},
          ${event.source},
          'client',
          ${identity.keyId},
          ${identity.anonymousHash},
          ${identity.sessionHash},
          ${event.creatorId},
          ${'recommendationId' in event ? event.recommendationId : null},
          ${'productId' in event ? event.productId : null},
          ${'discountCodeId' in event ? event.discountCodeId : null},
          ${sql.json(properties)}
        )
      `;

      if (event.name === 'creator.storefrontViewed') {
        await this.projectStorefrontView(sql, event, identity);
      } else if (event.name === 'creator.instagramTapped') {
        await this.projectInstagramTap(sql, event);
      } else if (event.name === 'recommendation.impression') {
        await this.projectRecommendationView(sql, event, identity);
      } else if (event.name === 'story.opened' || event.name === 'story.completed') {
        await this.projectStoryEvent(sql, event);
      } else {
        await this.projectCodeCopy(sql, event);
      }
      return 'accepted';
    });
  }

  async recordShopClick(link: ResolvedRedirect): Promise<void> {
    await this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const eventId = randomUUID();
      await sql`
        insert into analytics.event_receipts (event_id, source)
        values (${eventId}, 'server')
      `;
      await sql`
        insert into analytics.events (
          id,
          event_name,
          occurred_at,
          source,
          authority,
          creator_id,
          recommendation_id,
          product_id,
          affiliate_link_id
        ) values (
          ${eventId},
          'affiliate.shopClicked',
          statement_timestamp(),
          'server',
          'redirect',
          ${link.creatorId},
          ${link.recommendationId},
          ${link.productId},
          ${link.id}
        )
      `;
      await sql`
        insert into analytics.creator_daily_metrics (
          creator_id,
          metric_date,
          shop_clicks
        ) values (${link.creatorId}, current_date, 1)
        on conflict (creator_id, metric_date) do update
        set shop_clicks = analytics.creator_daily_metrics.shop_clicks + 1
      `;
      await sql`
        insert into analytics.recommendation_daily_metrics (
          recommendation_id,
          metric_date,
          shop_clicks
        ) values (${link.recommendationId}, current_date, 1)
        on conflict (recommendation_id, metric_date) do update
        set shop_clicks = analytics.recommendation_daily_metrics.shop_clicks + 1
      `;
      await sql`
        insert into analytics.link_daily_metrics (
          affiliate_link_id,
          metric_date,
          clicks
        ) values (${link.id}, current_date, 1)
        on conflict (affiliate_link_id, metric_date) do update
        set clicks = analytics.link_daily_metrics.clicks + 1
      `;
    });
  }

  async getCreatorDashboard(
    userId: string,
    days: number,
  ): Promise<CreatorAnalyticsDashboard | null> {
    const [creator] = await this.database.sql<{ id: string }[]>`
      select id
      from app.creator_profiles
      where user_id = ${userId}
        and status = 'approved'
        and published_at is not null
    `;
    if (!creator) return null;

    const [series, recommendations] = await Promise.all([
      this.database.sql<MetricRow[]>`
        select
          day::date::text as date,
          coalesce(metric.storefront_views, 0)::integer as "storefrontViews",
          coalesce(metric.unique_visitors, 0)::integer as "uniqueVisitors",
          coalesce(metric.recommendation_views, 0)::integer as "recommendationViews",
          coalesce(metric.story_opens, 0)::integer as "storyOpens",
          coalesce(metric.story_completions, 0)::integer as "storyCompletions",
          coalesce(metric.code_copies, 0)::integer as "codeCopies",
          coalesce(metric.instagram_taps, 0)::integer as "instagramTaps",
          coalesce(metric.shop_clicks, 0)::integer as "shopClicks"
        from generate_series(
          current_date - (${days}::integer - 1),
          current_date,
          interval '1 day'
        ) day
        left join analytics.creator_daily_metrics metric
          on metric.creator_id = ${creator.id}
         and metric.metric_date = day::date
        order by day
      `,
      this.database.sql<RecommendationMetricRow[]>`
        select
          recommendation.id,
          category.name_en as "categoryName",
          category.slug::text as "categorySlug",
          coalesce(image.public_url, recommendation.image_url) as "imageUrl",
          product.name as "productName",
          coalesce(sum(metric.views), 0)::integer as views,
          coalesce(sum(metric.code_copies), 0)::integer as "codeCopies",
          coalesce(sum(metric.story_opens), 0)::integer as "storyOpens",
          coalesce(sum(metric.story_completions), 0)::integer as "storyCompletions",
          coalesce(sum(metric.shop_clicks), 0)::integer as "shopClicks"
        from app.recommendations recommendation
        join app.products product on product.id = recommendation.product_id
        join app.categories category on category.id = product.primary_category_id
        left join app.media_assets image on image.id = recommendation.image_asset_id
        left join analytics.recommendation_daily_metrics metric
          on metric.recommendation_id = recommendation.id
         and metric.metric_date >= current_date - (${days}::integer - 1)
        where recommendation.creator_id = ${creator.id}
          and recommendation.deleted_at is null
        group by recommendation.id, product.name, category.name_en,
          category.slug, image.public_url
        order by
          coalesce(sum(metric.shop_clicks), 0) desc,
          coalesce(sum(metric.views), 0) desc,
          recommendation.id
      `,
    ]);

    const summary = series.reduce(
      (total, metric) => ({
        codeCopies: total.codeCopies + metric.codeCopies,
        instagramTaps: total.instagramTaps + metric.instagramTaps,
        recommendationViews: total.recommendationViews + metric.recommendationViews,
        shopClicks: total.shopClicks + metric.shopClicks,
        storyCompletions: total.storyCompletions + metric.storyCompletions,
        storyOpens: total.storyOpens + metric.storyOpens,
        storefrontViews: total.storefrontViews + metric.storefrontViews,
        uniqueVisitors: total.uniqueVisitors + metric.uniqueVisitors,
      }),
      emptyMetric(),
    );
    return {
      range: {
        days,
        from: series.at(0)?.date ?? new Date().toISOString().slice(0, 10),
        to: series.at(-1)?.date ?? new Date().toISOString().slice(0, 10),
      },
      recommendations,
      series,
      summary,
    };
  }

  private async hashIdentity(
    sql: DatabaseClient,
    anonymousId: string,
    sessionId: string,
  ): Promise<HashIdentity> {
    const [identity] = await sql<HashIdentity[]>`
      select
        id as "keyId",
        encode(
          extensions.hmac(convert_to(${anonymousId}, 'UTF8'), key_material, 'sha256'),
          'hex'
        ) as "anonymousHash",
        encode(
          extensions.hmac(convert_to(${sessionId}, 'UTF8'), key_material, 'sha256'),
          'hex'
        ) as "sessionHash"
      from analytics.identity_hash_keys
      where retired_at is null
      order by created_at desc
      limit 1
    `;
    if (!identity) throw new Error('Analytics identity hash key is unavailable');
    return identity;
  }

  private async validateClientContext(
    sql: DatabaseClient,
    event: ClientAnalyticsEvent,
  ): Promise<boolean> {
    if (
      event.name === 'creator.storefrontViewed' ||
      event.name === 'creator.instagramTapped'
    ) {
      const [creator] = await sql<{ valid: boolean }[]>`
        select true as valid
        from app.creator_profiles
        where id = ${event.creatorId}
          and status = 'approved'
          and published_at is not null
      `;
      return creator?.valid ?? false;
    }
    if (
      event.name === 'recommendation.impression' ||
      event.name === 'story.opened' ||
      event.name === 'story.completed'
    ) {
      const [recommendation] = await sql<{ valid: boolean }[]>`
        select true as valid
        from app.recommendations recommendation
        join app.creator_profiles creator on creator.id = recommendation.creator_id
        join app.products product on product.id = recommendation.product_id
        where recommendation.id = ${event.recommendationId}
          and recommendation.creator_id = ${event.creatorId}
          and recommendation.product_id = ${event.productId}
          and recommendation.lifecycle = 'published'
          and recommendation.deleted_at is null
          and creator.status = 'approved'
          and creator.published_at is not null
          and product.status = 'active'
      `;
      return recommendation?.valid ?? false;
    }
    const [code] = await sql<{ valid: boolean }[]>`
      select true as valid
      from app.discount_codes code
      join app.creator_profiles creator on creator.id = code.creator_id
      join app.merchants merchant on merchant.id = code.merchant_id
      where code.id = ${event.discountCodeId}
        and code.creator_id = ${event.creatorId}
        and code.lifecycle_status = 'published'
        and code.deleted_at is null
        and creator.status = 'approved'
        and creator.published_at is not null
        and merchant.status = 'active'
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
          ${event.recommendationId}::uuid is null
          or exists (
            select 1
            from app.recommendation_discount_codes placement
            join app.recommendations recommendation
              on recommendation.id = placement.recommendation_id
            where placement.code_id = code.id
              and placement.recommendation_id = ${event.recommendationId}
              and recommendation.lifecycle = 'published'
              and recommendation.deleted_at is null
          )
        )
    `;
    return code?.valid ?? false;
  }

  private async projectStorefrontView(
    sql: DatabaseClient,
    event: Extract<ClientAnalyticsEvent, { name: 'creator.storefrontViewed' }>,
    identity: HashIdentity,
  ): Promise<void> {
    const [visitor] = await sql<{ inserted: boolean }[]>`
      with inserted as (
        insert into analytics.creator_daily_visitors (
          creator_id,
          metric_date,
          anonymous_id_hash
        ) values (
          ${event.creatorId},
          (${event.occurredAt}::timestamptz at time zone 'utc')::date,
          ${identity.anonymousHash}
        )
        on conflict do nothing
        returning 1
      )
      select exists(select 1 from inserted) as inserted
    `;
    await sql`
      insert into analytics.creator_daily_metrics (
        creator_id,
        metric_date,
        storefront_views,
        unique_visitors
      ) values (
        ${event.creatorId},
        (${event.occurredAt}::timestamptz at time zone 'utc')::date,
        1,
        ${visitor?.inserted ? 1 : 0}
      )
      on conflict (creator_id, metric_date) do update
      set
        storefront_views = analytics.creator_daily_metrics.storefront_views + excluded.storefront_views,
        unique_visitors = analytics.creator_daily_metrics.unique_visitors + excluded.unique_visitors
    `;
  }

  private async projectRecommendationView(
    sql: DatabaseClient,
    event: Extract<ClientAnalyticsEvent, { name: 'recommendation.impression' }>,
    identity: HashIdentity,
  ): Promise<void> {
    const [view] = await sql<{ inserted: boolean }[]>`
      with inserted as (
        insert into analytics.recommendation_view_deduplication (
          recommendation_id,
          metric_date,
          session_id_hash
        ) values (
          ${event.recommendationId},
          (${event.occurredAt}::timestamptz at time zone 'utc')::date,
          ${identity.sessionHash}
        )
        on conflict do nothing
        returning 1
      )
      select exists(select 1 from inserted) as inserted
    `;
    if (!view?.inserted) return;
    await sql`
      insert into analytics.creator_daily_metrics (
        creator_id,
        metric_date,
        recommendation_views
      ) values (
        ${event.creatorId},
        (${event.occurredAt}::timestamptz at time zone 'utc')::date,
        1
      )
      on conflict (creator_id, metric_date) do update
      set recommendation_views = analytics.creator_daily_metrics.recommendation_views + 1
    `;
    await sql`
      insert into analytics.recommendation_daily_metrics (
        recommendation_id,
        metric_date,
        views
      ) values (
        ${event.recommendationId},
        (${event.occurredAt}::timestamptz at time zone 'utc')::date,
        1
      )
      on conflict (recommendation_id, metric_date) do update
      set views = analytics.recommendation_daily_metrics.views + 1
    `;
  }

  private async projectInstagramTap(
    sql: DatabaseClient,
    event: Extract<ClientAnalyticsEvent, { name: 'creator.instagramTapped' }>,
  ): Promise<void> {
    await sql`
      insert into analytics.creator_daily_metrics (
        creator_id,
        metric_date,
        instagram_taps
      ) values (
        ${event.creatorId},
        (${event.occurredAt}::timestamptz at time zone 'utc')::date,
        1
      )
      on conflict (creator_id, metric_date) do update
      set instagram_taps = analytics.creator_daily_metrics.instagram_taps + 1
    `;
  }

  private async projectCodeCopy(
    sql: DatabaseClient,
    event: Extract<ClientAnalyticsEvent, { name: 'discountCode.copied' }>,
  ): Promise<void> {
    await sql`
      insert into analytics.creator_daily_metrics (
        creator_id,
        metric_date,
        code_copies
      ) values (
        ${event.creatorId},
        (${event.occurredAt}::timestamptz at time zone 'utc')::date,
        1
      )
      on conflict (creator_id, metric_date) do update
      set code_copies = analytics.creator_daily_metrics.code_copies + 1
    `;
    if (!event.recommendationId) return;
    await sql`
      insert into analytics.recommendation_daily_metrics (
        recommendation_id,
        metric_date,
        code_copies
      ) values (
        ${event.recommendationId},
        (${event.occurredAt}::timestamptz at time zone 'utc')::date,
        1
      )
      on conflict (recommendation_id, metric_date) do update
      set code_copies = analytics.recommendation_daily_metrics.code_copies + 1
    `;
  }

  private async projectStoryEvent(
    sql: DatabaseClient,
    event: Extract<ClientAnalyticsEvent, { name: 'story.opened' | 'story.completed' }>,
  ): Promise<void> {
    if (event.name === 'story.opened') {
      await sql`
        insert into analytics.creator_daily_metrics (
          creator_id, metric_date, story_opens
        ) values (
          ${event.creatorId},
          (${event.occurredAt}::timestamptz at time zone 'utc')::date,
          1
        )
        on conflict (creator_id, metric_date) do update
        set story_opens = analytics.creator_daily_metrics.story_opens + 1
      `;
      await sql`
        insert into analytics.recommendation_daily_metrics (
          recommendation_id, metric_date, story_opens
        ) values (
          ${event.recommendationId},
          (${event.occurredAt}::timestamptz at time zone 'utc')::date,
          1
        )
        on conflict (recommendation_id, metric_date) do update
        set story_opens = analytics.recommendation_daily_metrics.story_opens + 1
      `;
      return;
    }

    await sql`
      insert into analytics.creator_daily_metrics (
        creator_id, metric_date, story_completions
      ) values (
        ${event.creatorId},
        (${event.occurredAt}::timestamptz at time zone 'utc')::date,
        1
      )
      on conflict (creator_id, metric_date) do update
      set story_completions = analytics.creator_daily_metrics.story_completions + 1
    `;
    await sql`
      insert into analytics.recommendation_daily_metrics (
        recommendation_id, metric_date, story_completions
      ) values (
        ${event.recommendationId},
        (${event.occurredAt}::timestamptz at time zone 'utc')::date,
        1
      )
      on conflict (recommendation_id, metric_date) do update
      set story_completions = analytics.recommendation_daily_metrics.story_completions + 1
    `;
  }
}

function emptyMetric(): CreatorAnalyticsDashboard['summary'] {
  return {
    codeCopies: 0,
    instagramTaps: 0,
    recommendationViews: 0,
    shopClicks: 0,
    storyCompletions: 0,
    storyOpens: 0,
    storefrontViews: 0,
    uniqueVisitors: 0,
  };
}
