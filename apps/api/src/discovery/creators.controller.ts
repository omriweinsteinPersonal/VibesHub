import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import {
  creatorCardSchema,
  recommendationDirectoryQuerySchema,
} from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';

import { problem } from '../api-problem.js';
import { Public } from '../auth/auth.decorators.js';
import { collectionResponse, singleResponse } from '../http-response.js';
import { DiscountCodeRepository } from '../discounts/discount-code.repository.js';
import { decodeRecommendationCursor } from '../recommendations/recommendation.js';
import { RecommendationRepository } from '../recommendations/recommendation.repository.js';
import {
  decodeCreatorDirectoryCursor,
  parseCreatorDirectoryQuery,
} from './creator-directory.js';
import { CreatorDirectoryRepository } from './creator-directory.repository.js';

@Controller('creators')
@Public()
export class CreatorsController {
  constructor(
    private readonly creators: CreatorDirectoryRepository,
    private readonly recommendations: RecommendationRepository,
    private readonly discountCodes: DiscountCodeRepository,
  ) {}

  @Get()
  async list(@Query() rawQuery: unknown, @Req() request: FastifyRequest) {
    const query = parseCreatorDirectoryQuery(rawQuery);
    const cursor = decodeCreatorDirectoryCursor(query.cursor, query);
    const page = await this.creators.list(query, cursor);
    return collectionResponse(page.items, page.nextCursor, request.id);
  }

  @Get(':handle/discount-codes')
  async listDiscountCodes(
    @Param('handle') rawHandle: string,
    @Req() request: FastifyRequest,
  ) {
    const handle = creatorCardSchema.shape.handle.parse(rawHandle);
    const storefront = await this.creators.findPublishedByHandle(handle);
    if (!storefront) throw this.notFound();
    return collectionResponse(
      await this.discountCodes.listPublished(storefront.id),
      null,
      request.id,
    );
  }

  @Get(':handle/recommendations')
  async listRecommendations(
    @Param('handle') rawHandle: string,
    @Query() rawQuery: unknown,
    @Req() request: FastifyRequest,
  ) {
    const handle = creatorCardSchema.shape.handle.parse(rawHandle);
    const storefront = await this.creators.findPublishedByHandle(handle);
    if (!storefront) throw this.notFound();
    const query = recommendationDirectoryQuerySchema.parse(rawQuery);
    const cursor = decodeRecommendationCursor(
      query.cursor,
      `storefront:${storefront.handle}`,
    );
    const page = await this.recommendations.listPublished(
      storefront.id,
      storefront.handle,
      query.limit,
      cursor,
    );
    return collectionResponse(page.items, page.nextCursor, request.id);
  }

  @Get(':handle')
  async getStorefront(
    @Param('handle') rawHandle: string,
    @Req() request: FastifyRequest,
  ) {
    const handle = creatorCardSchema.shape.handle.parse(rawHandle);
    const storefront = await this.creators.findPublishedByHandle(handle);
    if (!storefront) throw this.notFound();
    return singleResponse(storefront, request.id);
  }

  private notFound() {
    return problem(404, 'RESOURCE_NOT_FOUND', 'Creator storefront not found');
  }
}
