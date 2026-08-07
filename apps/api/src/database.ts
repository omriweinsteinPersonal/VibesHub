import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import postgres, { type Sql } from 'postgres';

import { parseApiConfig } from './config.js';

export type DatabaseClient = Sql<Record<string, unknown>>;

export function databaseClientOptions(
  nodeEnv: 'development' | 'test' | 'production',
  poolMax: number,
) {
  return {
    idle_timeout: 20,
    max: poolMax,
    // Supavisor transaction mode (port 6543) cannot retain prepared statements
    // between transactions. Keep this false everywhere so local behavior cannot
    // drift from production behavior.
    prepare: false,
    ssl: nodeEnv === 'production' ? ('require' as const) : false,
  };
}

@Injectable()
export class Database implements OnApplicationShutdown {
  private readonly client: DatabaseClient | null;

  constructor() {
    const config = parseApiConfig(process.env);
    this.client = config.databaseUrl
      ? postgres(
          config.databaseUrl,
          databaseClientOptions(config.nodeEnv, config.databasePoolMax),
        )
      : null;
  }

  get sql(): DatabaseClient {
    if (!this.client) throw new Error('Database access is not configured');
    return this.client;
  }

  async checkHealth(): Promise<void> {
    await this.sql`select 1`;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client) await this.client.end({ timeout: 5 });
  }
}
