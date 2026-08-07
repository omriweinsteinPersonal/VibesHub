import { Controller, Get, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { Public } from '../auth/auth.decorators.js';
import { collectionResponse } from '../http-response.js';
import {
  decodeCreatorDirectoryCursor,
  parseCreatorDirectoryQuery,
} from './creator-directory.js';
import { CreatorDirectoryRepository } from './creator-directory.repository.js';

@Controller('creators')
@Public()
export class CreatorsController {
  constructor(private readonly creators: CreatorDirectoryRepository) {}

  @Get()
  async list(@Query() rawQuery: unknown, @Req() request: FastifyRequest) {
    const query = parseCreatorDirectoryQuery(rawQuery);
    const cursor = decodeCreatorDirectoryCursor(query.cursor, query);
    const page = await this.creators.list(query, cursor);
    return collectionResponse(page.items, page.nextCursor, request.id);
  }
}
