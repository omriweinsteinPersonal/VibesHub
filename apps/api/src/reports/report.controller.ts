import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { contentReportInputSchema } from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';

import { Public } from '../auth/auth.decorators.js';
import { singleResponse } from '../http-response.js';
import { ReportService } from './report.service.js';

@Controller('reports')
@Public()
export class ReportController {
  constructor(private readonly reports: ReportService) {}

  @Post()
  @HttpCode(202)
  async create(@Body() body: unknown, @Req() request: FastifyRequest) {
    const input = contentReportInputSchema.parse(body);
    return singleResponse(await this.reports.create(input), request.id);
  }
}
