import { describe, expect, it } from 'vitest';

import { visibleAnalyticsDays } from './analytics-activity';

describe('visible analytics days', () => {
  it('shows the latest seven days first without changing the source', () => {
    const days = Array.from({ length: 10 }, (_, i) => i + 1);
    expect(visibleAnalyticsDays(days, false)).toEqual([10, 9, 8, 7, 6, 5, 4]);
    expect(days).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('can show the full range and handles empty data', () => {
    expect(visibleAnalyticsDays([1, 2, 3], true)).toEqual([3, 2, 1]);
    expect(visibleAnalyticsDays([], false)).toEqual([]);
  });
});
