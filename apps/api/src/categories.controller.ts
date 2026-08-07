import { Controller, Get, Req } from '@nestjs/common';
import type { CategoryCard } from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';

import { Public } from './auth/auth.decorators.js';
import { Database } from './database.js';
import { collectionResponse } from './http-response.js';

@Controller('categories')
@Public()
export class CategoriesController {
  constructor(private readonly database: Database) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    const categories = await this.database.sql<CategoryCard[]>`
      select
        id,
        slug::text as slug,
        name_en as name,
        description_he as "descriptionHe"
      from app.categories
      where is_active = true
      order by sort_order, id
    `;
    return collectionResponse(categories, null, request.id);
  }
}
