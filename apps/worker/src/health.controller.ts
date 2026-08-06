import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { service: string; status: 'ok' } {
    return { service: 'vibeshub-worker', status: 'ok' };
  }
}
