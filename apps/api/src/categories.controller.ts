import { Controller, Get, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { Public } from './auth/auth.decorators.js';
import { Database } from './database.js';
import { singleResponse } from './http-response.js';

interface CategoryRow {
  descriptionHe: string | null;
  id: string;
  name: string;
  slug: string;
}

@Controller('categories')
@Public()
export class CategoriesController {
  constructor(private readonly database: Database) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    const categories = await this.database.sql<CategoryRow[]>`
      select
        id,
        slug::text as slug,
        name_en as name,
        description_he as "descriptionHe"
      from app.categories
      where is_active = true
      order by sort_order, id
    `;
    return singleResponse(categories, request.id);
  }
}
