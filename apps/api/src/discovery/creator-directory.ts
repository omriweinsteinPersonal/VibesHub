import {
  type CreatorDirectoryQuery,
  creatorDirectoryQuerySchema,
  idSchema,
} from '@vibeshub/contracts';
import { z } from 'zod';

import { problem } from '../api-problem.js';

const cursorPayloadSchema = z
  .object({
    category: z.string().nullable(),
    followerCount: z.int().nonnegative(),
    id: idSchema,
    q: z.string().nullable(),
  })
  .strict();

export type CreatorDirectoryCursor = z.infer<typeof cursorPayloadSchema>;

export function parseCreatorDirectoryQuery(input: unknown): CreatorDirectoryQuery {
  return creatorDirectoryQuerySchema.parse(input);
}

export function encodeCreatorDirectoryCursor(
  cursor: Pick<CreatorDirectoryCursor, 'followerCount' | 'id'>,
  query: CreatorDirectoryQuery,
): string {
  return Buffer.from(
    JSON.stringify({
      ...cursor,
      category: query.category ?? null,
      q: query.q ?? null,
    }),
  ).toString('base64url');
}

export function decodeCreatorDirectoryCursor(
  cursor: string | undefined,
  query: CreatorDirectoryQuery,
): CreatorDirectoryCursor | null {
  if (!cursor) return null;

  try {
    const payload = cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
    if (
      payload.category !== (query.category ?? null) ||
      payload.q !== (query.q ?? null)
    ) {
      throw new Error('Cursor filters do not match');
    }
    return payload;
  } catch {
    throw problem(
      422,
      'VALIDATION_FAILED',
      'The directory cursor is invalid',
      'Start a new directory request without the cursor.',
    );
  }
}
