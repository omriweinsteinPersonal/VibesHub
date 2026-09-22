import type { RecommendationCard } from '@vibeshub/contracts';

import { publicApiCollectionRequest } from './api';

export async function loadStorefrontRecommendations(
  handle: string,
): Promise<RecommendationCard[]> {
  const items: RecommendationCard[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: '48' });
    if (cursor) query.set('cursor', cursor);
    const page = await publicApiCollectionRequest<RecommendationCard>(
      `/creators/${encodeURIComponent(handle)}/recommendations?${query.toString()}`,
    );
    items.push(...page.data);
    cursor = page.page.nextCursor;
  } while (cursor);
  return items;
}
