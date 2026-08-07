import {
  type DiscoveryRecommendationQuery,
  discoveryRecommendationQuerySchema,
  type GlobalSearchQuery,
  globalSearchQuerySchema,
} from '@vibeshub/contracts';
import { z } from 'zod';

import { problem } from '../api-problem.js';

const cursorPayloadSchema = z
  .object({
    category: z.string().nullable(),
    id: z.uuid(),
    publishedAt: z.iso.datetime(),
    q: z.string().nullable(),
    rank: z.int().nonnegative(),
    sort: discoveryRecommendationQuerySchema.shape.sort,
  })
  .strict();

export type ProductDiscoveryCursor = z.infer<typeof cursorPayloadSchema>;

export function parseProductDiscoveryQuery(input: unknown): DiscoveryRecommendationQuery {
  return discoveryRecommendationQuerySchema.parse(input);
}

export function parseGlobalSearchQuery(input: unknown): GlobalSearchQuery {
  return globalSearchQuerySchema.parse(input);
}

export function encodeProductDiscoveryCursor(
  cursor: Pick<ProductDiscoveryCursor, 'id' | 'publishedAt' | 'rank'>,
  query: DiscoveryRecommendationQuery,
): string {
  return Buffer.from(
    JSON.stringify({
      ...cursor,
      category: query.category ?? null,
      q: query.q ?? null,
      sort: query.sort,
    }),
    'utf8',
  ).toString('base64url');
}

export function decodeProductDiscoveryCursor(
  value: string | undefined,
  query: DiscoveryRecommendationQuery,
): ProductDiscoveryCursor | null {
  if (!value) return null;
  try {
    const cursor = cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
    );
    if (
      cursor.category !== (query.category ?? null) ||
      cursor.q !== (query.q ?? null) ||
      cursor.sort !== query.sort
    ) {
      throw new Error('Cursor filters do not match');
    }
    return cursor;
  } catch {
    throw problem(
      422,
      'VALIDATION_FAILED',
      'The product discovery cursor is invalid',
      'Start a new discovery request without the cursor.',
    );
  }
}
