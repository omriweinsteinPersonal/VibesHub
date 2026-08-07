import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import postgres, { type Sql } from 'postgres';

import { parseApiConfig } from './config.js';

export type DatabaseClient = Sql<Record<string, unknown>>;

@Injectable()
export class Database implements OnApplicationShutdown {
  private readonly client: DatabaseClient | null;

  constructor() {
    const config = parseApiConfig(process.env);
    this.client = config.databaseUrl
      ? postgres(config.databaseUrl, {
          idle_timeout: 20,
          max: 10,
          prepare: true,
          ssl: config.nodeEnv === 'production' ? 'require' : false,
        })
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
