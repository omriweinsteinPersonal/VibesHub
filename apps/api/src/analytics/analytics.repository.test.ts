import { describe, expect, it, vi } from 'vitest';

import { AnalyticsRepository } from './analytics.repository.js';

describe('AnalyticsRepository', () => {
  it('uses the range-wide distinct visitor count in the dashboard summary', async () => {
    const metric = {
      codeCopies: 0,
      instagramTaps: 0,
      recommendationViews: 0,
      shopClicks: 0,
      storyCompletions: 0,
      storyOpens: 0,
      storefrontViews: 1,
      uniqueVisitors: 1,
    };
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'creator-id' }])
      .mockResolvedValueOnce([
        { ...metric, date: '2026-10-02' },
        { ...metric, date: '2026-10-03' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ uniqueVisitors: 1 }]);
    const repository = new AnalyticsRepository({ sql } as never);

    const dashboard = await repository.getCreatorDashboard('user-id', 30);

    expect(dashboard?.summary).toMatchObject({
      storefrontViews: 2,
      uniqueVisitors: 1,
    });
    expect(dashboard?.series.map(({ uniqueVisitors }) => uniqueVisitors)).toEqual([1, 1]);
  });
});
