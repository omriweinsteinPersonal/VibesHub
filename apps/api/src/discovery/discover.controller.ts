import { Controller, Get, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { Public } from '../auth/auth.decorators.js';
import { collectionResponse, singleResponse } from '../http-response.js';
import { ProductDiscoveryRepository } from './product-discovery.repository.js';
import {
  decodeProductDiscoveryCursor,
  parseGlobalSearchQuery,
  parseProductDiscoveryQuery,
} from './product-discovery.js';

@Controller('discover')
@Public()
export class DiscoverController {
  constructor(private readonly discovery: ProductDiscoveryRepository) {}

  @Get('recommendations')
  async listRecommendations(@Query() rawQuery: unknown, @Req() request: FastifyRequest) {
    const query = parseProductDiscoveryQuery(rawQuery);
    const cursor = decodeProductDiscoveryCursor(query.cursor, query);
    const page = await this.discovery.list(query, cursor);
    return collectionResponse(page.items, page.nextCursor, request.id);
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
