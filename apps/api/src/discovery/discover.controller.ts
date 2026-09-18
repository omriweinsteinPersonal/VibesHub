import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { idSchema } from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';

import { problem } from '../api-problem.js';
import { Public } from '../auth/auth.decorators.js';
import { collectionResponse, singleResponse } from '../http-response.js';
import { RecommendationRepository } from '../recommendations/recommendation.repository.js';
import { ProductDiscoveryRepository } from './product-discovery.repository.js';
import {
  decodeProductDiscoveryCursor,
  parseGlobalSearchQuery,
  parseProductDiscoveryQuery,
} from './product-discovery.js';

@Controller('discover')
@Public()
export class DiscoverController {
  constructor(
    private readonly discovery: ProductDiscoveryRepository,
    private readonly recommendations: RecommendationRepository,
  ) {}

  @Get('recommendations')
  async listRecommendations(@Query() rawQuery: unknown, @Req() request: FastifyRequest) {
    const query = parseProductDiscoveryQuery(rawQuery);
    const cursor = decodeProductDiscoveryCursor(query.cursor, query);
    const page = await this.discovery.list(query, cursor);
    return collectionResponse(page.items, page.nextCursor, request.id);
  }

  @Get('recommendations/:id')
  async recommendation(@Param('id') rawId: string, @Req() request: FastifyRequest) {
    const recommendation = await this.recommendations.findPublishedById(
      idSchema.parse(rawId),
    );
    if (!recommendation) {
      throw problem(404, 'RESOURCE_NOT_FOUND', 'Recommendation not found');
    }
    return singleResponse(recommendation, request.id);
  }
}

@Controller('search')
@Public()
export class SearchController {
  constructor(private readonly discovery: ProductDiscoveryRepository) {}

  @Get()
  async search(@Query() rawQuery: unknown, @Req() request: FastifyRequest) {
    const results = await this.discovery.search(parseGlobalSearchQuery(rawQuery));
    return singleResponse(results, request.id);
  }
}
