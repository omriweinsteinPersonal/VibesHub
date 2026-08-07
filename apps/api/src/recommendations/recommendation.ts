import { createHash } from 'node:crypto';

import { z } from 'zod';

import { problem } from '../api-problem.js';

const cursorPayloadSchema = z
  .object({
    id: z.uuid(),
    scope: z.string().min(1).max(100),
    timestamp: z.iso.datetime(),
  })
  .strict();

export interface RecommendationCursor {
  id: string;
  timestamp: string;
}

export function normalizeCatalogName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

export function catalogSlug(value: string, identity: string): string {
  const readable = value
    .normalize('NFKD')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const digest = createHash('sha256').update(identity).digest('hex').slice(0, 8);
  return `${readable || 'item'}-${digest}`;
}

export function encodeRecommendationCursor(
  cursor: RecommendationCursor,
  scope: string,
): string {
  return Buffer.from(JSON.stringify({ ...cursor, scope }), 'utf8').toString('base64url');
}

export function decodeRecommendationCursor(
  value: string | undefined,
  scope: string,
): RecommendationCursor | null {
  if (!value) return null;
  try {
    const parsed = cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
    );
    if (parsed.scope !== scope) throw new Error('Cursor scope mismatch');
    return { id: parsed.id, timestamp: parsed.timestamp };
  } catch {
    throw problem(422, 'VALIDATION_FAILED', 'The recommendation cursor is invalid');
  }
}

export function parseIfMatch(value: string | undefined): number {
  const match = value?.match(/^"([1-9][0-9]*)"$/);
  if (!match?.[1]) {
    throw problem(
      428,
      'PRECONDITION_REQUIRED',
      'A strong If-Match version is required',
      'Send the current recommendation version as a quoted ETag, for example If-Match: "3".',
    );
  }
  return Number.parseInt(match[1], 10);
}
