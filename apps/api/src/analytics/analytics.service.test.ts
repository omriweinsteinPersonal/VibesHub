import { describe, expect, it, vi } from 'vitest';

import type { ClientAnalyticsBatch } from '@vibeshub/analytics';

import { AnalyticsService } from './analytics.service.js';

const batch: ClientAnalyticsBatch = {
  batchId: '01989f72-07e4-7f32-9b42-1ba55d4ca001',
  events: [
    {
      anonymousId: '01989f72-07e4-7f32-9b42-1ba55d4ca002',
      creatorId: '01989f72-07e4-7f32-9b42-1ba55d4ca003',
      eventId: '01989f72-07e4-7f32-9b42-1ba55d4ca004',
      name: 'creator.storefrontViewed',
      occurredAt: new Date().toISOString(),
      schemaVersion: 1,
      sessionId: '01989f72-07e4-7f32-9b42-1ba55d4ca005',
      source: 'web',
    },
  ],
};

describe('AnalyticsService', () => {
  it('returns a bounded ingestion summary', async () => {
    const repository = {
      claimRateLimit: vi.fn().mockResolvedValue(true),
      ingestClientEvent: vi.fn().mockResolvedValue('accepted'),
    };
    const service = new AnalyticsService(repository as never);

    await expect(service.ingestClientBatch(batch, '127.0.0.1')).resolves.toEqual({
      accepted: 1,
      duplicates: 0,
      rejected: 0,
    });
  });

  it('rejects events outside the allowed clock window without storing them', async () => {
    const repository = {
      claimRateLimit: vi.fn().mockResolvedValue(true),
      ingestClientEvent: vi.fn(),
    };
    const service = new AnalyticsService(repository as never);
    const oldBatch: ClientAnalyticsBatch = {
      ...batch,
      events: [
        {
          ...batch.events[0]!,
          occurredAt: new Date(Date.now() - 25 * 60 * 60 * 1_000).toISOString(),
        },
      ],
    };

    await expect(service.ingestClientBatch(oldBatch, '127.0.0.1')).resolves.toEqual({
      accepted: 0,
      duplicates: 0,
      rejected: 1,
    });
    expect(repository.ingestClientEvent).not.toHaveBeenCalled();
  });

  it('fails closed when the rate limit cannot be claimed', async () => {
    const repository = { claimRateLimit: vi.fn().mockResolvedValue(false) };
    const service = new AnalyticsService(repository as never);

    await expect(service.ingestClientBatch(batch, '127.0.0.1')).rejects.toMatchObject({
      response: { code: 'RATE_LIMITED' },
    });
  });
});
