import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  creatorRecommendationInputSchema,
  creatorRecommendationPatchSchema,
  recommendationDirectoryQuerySchema,
  type CreatorRecommendationInput,
  type CreatorRecommendationPatch,
} from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';

import { CurrentActor, RequireCapabilities } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { collectionResponse, singleResponse } from '../http-response.js';
import { IdempotencyService } from '../idempotency.service.js';
import { decodeRecommendationCursor, parseIfMatch } from './recommendation.js';
import { RecommendationService } from './recommendation.service.js';

@Controller('creator/recommendations')
@RequireCapabilities('creator:manage_content')
export class CreatorRecommendationsController {
  constructor(
    private readonly recommendations: RecommendationService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post()
  async create(
    @CurrentActor() actor: RequestActor,
    @Body() body: CreatorRecommendationInput,
    @Headers('idempotency-key') header: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const input = creatorRecommendationInputSchema.parse(body);
    const key = this.idempotency.requireKey(header);
    const data = await this.idempotency.execute(
      actor.userId,
      'creator-recommendations.create',
      key,
      input,
      () => this.recommendations.create(actor.userId, input),
    );
    return singleResponse(data, request.id);
  }

  @Get()
  async list(
    @CurrentActor() actor: RequestActor,
    @Query() rawQuery: unknown,
    @Req() request: FastifyRequest,
  ) {
    const query = recommendationDirectoryQuerySchema.parse(rawQuery);
    const cursor = decodeRecommendationCursor(query.cursor, 'creator');
    const page = await this.recommendations.listOwned(actor.userId, query.limit, cursor);
    return collectionResponse(page.items, page.nextCursor, request.id);
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Req() request: FastifyRequest,
  ) {
    return singleResponse(
      await this.recommendations.getOwned(id, actor.userId),
      request.id,
    );
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: CreatorRecommendationPatch,
    @Req() request: FastifyRequest,
  ) {
    const input = creatorRecommendationPatchSchema.parse(body);
    return singleResponse(
      await this.recommendations.update(id, actor.userId, parseIfMatch(ifMatch), input),
      request.id,
    );
  }

  @Post(':id/publish')
  publish(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    return this.transition('publish', id, actor, ifMatch, idempotencyHeader, request);
  }

  @Post(':id/unpublish')
  unpublish(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    return this.transition('unpublish', id, actor, ifMatch, idempotencyHeader, request);
  }

  private async transition(
    command: 'publish' | 'unpublish',
    id: string,
    actor: RequestActor,
    ifMatch: string | undefined,
    idempotencyHeader: string | undefined,
    request: FastifyRequest,
  ) {
    const version = parseIfMatch(ifMatch);
    const key = this.idempotency.requireKey(idempotencyHeader);
    const data = await this.idempotency.execute(
      actor.userId,
      `creator-recommendations.${id}.${command}`,
      key,
      { id, version },
      () => this.recommendations[command](id, actor.userId, version),
    );
    return singleResponse(data, request.id);
  }
}
