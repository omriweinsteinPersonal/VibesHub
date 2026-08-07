import { idSchema } from '@vibeshub/contracts';
import { z } from 'zod';

import { problem } from '../api-problem.js';

const engagementCursorSchema = z
  .object({
    id: idSchema,
    scope: z.enum(['followed-creators', 'saved-products']),
    timestamp: z.iso.datetime(),
  })
  .strict();

export interface EngagementCursor {
  id: string;
  timestamp: string;
}

export function encodeEngagementCursor(
  cursor: EngagementCursor,
  scope: 'followed-creators' | 'saved-products',
): string {
  return Buffer.from(JSON.stringify({ ...cursor, scope }), 'utf8').toString('base64url');
}

export function decodeEngagementCursor(
  value: string | undefined,
  scope: 'followed-creators' | 'saved-products',
): EngagementCursor | null {
  if (!value) return null;
  try {
    const parsed = engagementCursorSchema.parse(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
    );
    if (parsed.scope !== scope) throw new Error('Cursor scope mismatch');
    return { id: parsed.id, timestamp: parsed.timestamp };
  } catch {
    throw problem(422, 'VALIDATION_FAILED', 'The engagement cursor is invalid');
  }
}
