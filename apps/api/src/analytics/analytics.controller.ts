import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  clientAnalyticsBatchSchema,
  type ClientAnalyticsBatch,
} from '@vibeshub/analytics';
import { z } from 'zod';
import type { FastifyRequest } from 'fastify';

import { CurrentActor, Public, RequireCapabilities } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { singleResponse } from '../http-response.js';
import { AnalyticsService } from './analytics.service.js';

const creatorAnalyticsQuerySchema = z
  .object({ days: z.coerce.number().int().min(7).max(90).default(30) })
  .strict();

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('client-events')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  async ingest(@Body() rawBody: ClientAnalyticsBatch, @Req() request: FastifyRequest) {
    const batch = clientAnalyticsBatchSchema.parse(rawBody);
    return singleResponse(
      await this.analytics.ingestClientBatch(batch, request.ip),
      request.id,
    );
  }
}

@Controller('creator/analytics')
export class CreatorAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @RequireCapabilities('creator:view_analytics')
  async dashboard(
    @CurrentActor() actor: RequestActor,
    @Query() rawQuery: unknown,
    @Req() request: FastifyRequest,
  ) {
    const query = creatorAnalyticsQuerySchema.parse(rawQuery);
    return singleResponse(
      await this.analytics.getCreatorDashboard(actor.userId, query.days),
      request.id,
    );
  }
}
