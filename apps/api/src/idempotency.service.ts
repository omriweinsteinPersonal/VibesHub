import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { idempotencyKeySchema } from '@vibeshub/contracts';

import { problem } from './api-problem.js';
import { Database } from './database.js';

interface IdempotencyRow {
  requestHash: string;
  responseBody: unknown;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly database: Database) {}

  requireKey(value: string | undefined): string {
    if (!value) {
      throw problem(400, 'MALFORMED_REQUEST', 'Idempotency-Key header is required');
    }
    return idempotencyKeySchema.parse(value);
  }

  async execute<T>(
    actorId: string,
    operation: string,
    key: string,
    payload: unknown,
    handler: () => Promise<T>,
  ): Promise<T> {
    const operationScope = `${actorId}:${operation}`;
    const requestHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const inserted = await this.database.sql`
      insert into ops.idempotency_keys (key, actor_id, operation, request_hash, expires_at)
      values (${key}, ${actorId}, ${operationScope}, ${requestHash}, statement_timestamp() + interval '24 hours')
      on conflict do nothing
      returning key
    `;

    if (inserted.length === 0) {
      const [existing] = await this.database.sql<IdempotencyRow[]>`
        select request_hash as "requestHash", response_body as "responseBody"
        from ops.idempotency_keys
        where key = ${key} and operation = ${operationScope}
      `;
      if (!existing || existing.requestHash !== requestHash) {
        throw problem(409, 'IDEMPOTENCY_CONFLICT', 'The idempotency key was reused');
      }
      if (existing.responseBody === null) {
        throw problem(
          409,
          'IDEMPOTENCY_CONFLICT',
          'The original operation is still processing',
        );
      }
      return existing.responseBody as T;
    }

    try {
      const result = await handler();
      await this.database.sql`
        update ops.idempotency_keys
        set response_status = 200, response_body = ${JSON.stringify(result)}::jsonb
        where key = ${key} and operation = ${operationScope}
      `;
      return result;
    } catch (error) {
      await this.database.sql`
        delete from ops.idempotency_keys
        where key = ${key} and operation = ${operationScope} and response_body is null
      `;
      throw error;
    }
  }
}
