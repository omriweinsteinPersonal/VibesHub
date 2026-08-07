import { Controller, Get } from '@nestjs/common';

import { Public } from './auth/auth.decorators.js';

@Controller('health')
@Public()
export class HealthController {
  @Get()
  getHealth(): { service: string; status: 'ok' } {
    return { service: 'vibeshub-api', status: 'ok' };
  }
}
