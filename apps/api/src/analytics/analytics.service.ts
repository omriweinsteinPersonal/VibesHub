import { Injectable } from '@nestjs/common';
import type {
  ClientAnalyticsBatch,
  ClientAnalyticsBatchResult,
} from '@vibeshub/analytics';
import type { CreatorAnalyticsDashboard } from '@vibeshub/contracts';

import { problem } from '../api-problem.js';
import { AnalyticsRepository } from './analytics.repository.js';

const maximumPastAgeMs = 24 * 60 * 60 * 1_000;
const maximumFutureSkewMs = 5 * 60 * 1_000;

@Injectable()
export class AnalyticsService {
  constructor(private readonly analytics: AnalyticsRepository) {}

  async ingestClientBatch(
    batch: ClientAnalyticsBatch,
    networkAddress: string,
  ): Promise<ClientAnalyticsBatchResult> {
    const sessionId = batch.events[0]?.sessionId;
    if (
      !sessionId ||
      !(await this.analytics.claimRateLimit(
        sessionId,
        networkAddress,
        batch.events.length,
      ))
    ) {
      throw problem(429, 'RATE_LIMITED', 'Too many analytics events were submitted');
    }

    const result: ClientAnalyticsBatchResult = {
      accepted: 0,
      duplicates: 0,
      rejected: 0,
    };
    const now = Date.now();
    for (const event of batch.events) {
      const occurredAt = Date.parse(event.occurredAt);
      if (occurredAt < now - maximumPastAgeMs || occurredAt > now + maximumFutureSkewMs) {
        result.rejected += 1;
        continue;
      }
      const outcome = await this.analytics.ingestClientEvent(event);
      result[
        outcome === 'duplicate'
          ? 'duplicates'
          : outcome === 'accepted'
            ? 'accepted'
            : 'rejected'
      ] += 1;
    }
    return result;
  }

  async getCreatorDashboard(
    userId: string,
    days: number,
  ): Promise<CreatorAnalyticsDashboard> {
    const dashboard = await this.analytics.getCreatorDashboard(userId, days);
    if (!dashboard) {
      throw problem(
        403,
        'CAPABILITY_REQUIRED',
        'An approved creator profile is required',
      );
    }
    return dashboard;
  }
}
