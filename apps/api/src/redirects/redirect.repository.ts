import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { Database } from '../database.js';

export interface ResolvedRedirect {
  creatorId: string;
  destinationUrl: string;
  hostname: string;
  id: string;
  merchantId: string;
  productId: string;
  recommendationId: string;
}

@Injectable()
export class RedirectRepository {
  constructor(private readonly database: Database) {}

  async findActive(publicId: string): Promise<ResolvedRedirect | null> {
    const [link] = await this.database.sql<ResolvedRedirect[]>`
      select
        link.id,
        link.destination_url as "destinationUrl",
        lower(domain.hostname::text) as hostname,
        recommendation.id as "recommendationId",
        recommendation.creator_id as "creatorId",
        recommendation.product_id as "productId",
        link.merchant_id as "merchantId"
      from app.affiliate_links link
      join app.merchant_domains domain
        on domain.id = link.merchant_domain_id
       and domain.merchant_id = link.merchant_id
      join app.recommendations recommendation
        on recommendation.id = link.recommendation_id
      join app.creator_profiles creator on creator.id = recommendation.creator_id
      join app.product_offers offer
        on offer.id = link.offer_id
       and offer.merchant_id = link.merchant_id
      join app.products product on product.id = recommendation.product_id
      join app.merchants merchant on merchant.id = link.merchant_id
      where link.public_id = ${publicId}
        and link.status = 'active'
        and domain.allow_redirect = true
        and domain.verified_at is not null
        and recommendation.lifecycle = 'published'
        and recommendation.deleted_at is null
        and creator.status = 'approved'
        and creator.published_at is not null
        and offer.status = 'active'
        and product.status = 'active'
        and merchant.status = 'active'
      limit 1
    `;
    return link ?? null;
  }

  async recordEvent(
    link: ResolvedRedirect,
    eventType: 'affiliate.redirectBlocked.v1' | 'affiliate.shopClicked.v1',
    reason?: string,
  ): Promise<void> {
    const payload = {
      creatorId: link.creatorId,
      merchantId: link.merchantId,
      productId: link.productId,
      recommendationId: link.recommendationId,
      ...(reason ? { reason } : {}),
    };
    await this.database.sql`
      insert into ops.outbox_events (
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key
      ) values (
        'affiliate_link',
        ${link.id},
        ${eventType},
        ${JSON.stringify(payload)}::jsonb,
        ${`redirect:${randomUUID()}`}
      )
    `;
  }
}
