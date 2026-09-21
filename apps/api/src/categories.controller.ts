import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { CategoryCard } from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

import { CurrentActor, Public, RequireCapabilities } from './auth/auth.decorators.js';
import type { RequestActor } from './auth/auth.types.js';
import { Database } from './database.js';
import { collectionResponse, singleResponse } from './http-response.js';

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

const customCategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
}).strict();

@Controller('creator/categories')
@RequireCapabilities('creator:manage_content')
export class CreatorCategoriesController {
  constructor(private readonly database: Database) {}

  @Get()
  async list(@CurrentActor() actor: RequestActor, @Req() request: FastifyRequest) {
    const categories = await this.database.sql<CategoryCard[]>`
      select category.id, category.slug::text as slug, category.name_en as name,
        category.description_he as "descriptionHe"
      from app.categories category
      where category.is_active = true
        and (category.created_by_user_id is null or category.created_by_user_id = ${actor.userId})
      order by category.sort_order, category.created_at, category.id
    `;
    return collectionResponse(categories, null, request.id);
  }

  @Post()
  async create(
    @CurrentActor() actor: RequestActor,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const { name } = customCategoryInputSchema.parse(body);
    const normalized = name.toLocaleLowerCase();
    const [category] = await this.database.sql<CategoryCard[]>`
      insert into app.categories (slug, name_en, created_by_user_id, sort_order)
      values (
        ${`custom-${crypto.randomUUID().slice(0, 12)}`},
        ${name},
        ${actor.userId},
        1000
      )
      on conflict (created_by_user_id, lower(name_en)) where created_by_user_id is not null
      do update set is_active = true
      returning id, slug::text as slug, name_en as name,
        description_he as "descriptionHe"
    `;
    if (!category) throw new Error(`Could not create category ${normalized}`);
    return singleResponse(category, request.id);
  }
}
