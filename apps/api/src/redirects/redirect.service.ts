import { Injectable } from '@nestjs/common';
import { logger } from '@vibeshub/observability';

import { AnalyticsRepository } from '../analytics/analytics.repository.js';
import {
  validateRedirectDestination,
  type ValidatedDestination,
} from './redirect-destination.js';
import { RedirectRepository, type ResolvedRedirect } from './redirect.repository.js';

const publicIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RedirectService {
  constructor(
    private readonly redirects: RedirectRepository,
    private readonly analytics: AnalyticsRepository,
  ) {}

  async resolve(publicId: string): Promise<string | null> {
    if (!publicIdPattern.test(publicId)) return null;
    const link = await this.redirects.findActive(publicId);
    if (!link) return null;

    let destination: ValidatedDestination;
    try {
      destination = validateRedirectDestination(link.destinationUrl);
      if (destination.hostname !== link.hostname) {
        throw new Error('MERCHANT_DOMAIN_MISMATCH');
      }
    } catch {
      await this.recordBestEffort(
        link,
        'affiliate.redirectBlocked.v1',
        'destination_invalid',
      );
      return null;
    }

    await this.recordBestEffort(link, 'affiliate.shopClicked.v1');
    return destination.destinationUrl;
  }

  private async recordBestEffort(
    link: ResolvedRedirect,
    eventType: 'affiliate.redirectBlocked.v1' | 'affiliate.shopClicked.v1',
    reason?: string,
  ): Promise<void> {
    const writes = [this.redirects.recordEvent(link, eventType, reason)];
    if (eventType === 'affiliate.shopClicked.v1') {
      writes.push(this.analytics.recordShopClick(link));
    }
    const results = await Promise.allSettled(writes);
    if (results.some(({ status }) => status === 'rejected')) {
      logger.warn('Redirect event could not be recorded', {
        affiliateLinkId: link.id,
        eventType,
      });
    }
  }
}
