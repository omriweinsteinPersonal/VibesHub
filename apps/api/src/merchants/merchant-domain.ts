import {
  idSchema,
  merchantDomainReviewStatusSchema,
  type MerchantDomainReviewStatus,
} from '@vibeshub/contracts';
import { z } from 'zod';

import { problem } from '../api-problem.js';

const cursorSchema = z
  .object({
    createdAt: z.iso.datetime(),
    id: idSchema,
    status: merchantDomainReviewStatusSchema,
  })
  .strict();

export type MerchantDomainQueueCursor = z.infer<typeof cursorSchema>;

export function encodeMerchantDomainQueueCursor(
  cursor: MerchantDomainQueueCursor,
): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeMerchantDomainQueueCursor(
  value: string | undefined,
  status: MerchantDomainReviewStatus,
): MerchantDomainQueueCursor | null {
  if (!value) return null;
  try {
    const cursor = cursorSchema.parse(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
    );
    if (cursor.status !== status) throw new Error('Cursor status does not match');
    return cursor;
  } catch {
    throw problem(
      422,
      'VALIDATION_FAILED',
      'The merchant-domain queue cursor is invalid',
      'Start a new queue request without the cursor.',
    );
  }
}
