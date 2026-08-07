import { Controller, Get } from '@nestjs/common';

import { Public } from './auth/auth.decorators.js';
import { Database } from './database.js';

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly database: Database) {}

  @Get()
  getHealth(): { service: string; status: 'ok' } {
    return { service: 'vibeshub-api', status: 'ok' };
  }

  @Get('ready')
  async getReadiness(): Promise<{ database: 'ok'; service: string; status: 'ready' }> {
    await this.database.checkHealth();
    return { database: 'ok', service: 'vibeshub-api', status: 'ready' };
  }
}
