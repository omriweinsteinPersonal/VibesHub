import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  engagementListQuerySchema,
  engagementStateInputSchema,
  idSchema,
  saveProductInputSchema,
  type EngagementStateInput,
  type SaveProductInput,
} from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';

import { problem } from '../api-problem.js';
import { CurrentActor, RequireCapabilities } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { collectionResponse, singleResponse } from '../http-response.js';
import { decodeEngagementCursor } from './engagement.js';
import { EngagementRepository } from './engagement.repository.js';

@Controller('me')
export class EngagementController {
  constructor(private readonly engagement: EngagementRepository) {}

  @Post('engagement-state')
  @RequireCapabilities('shopper:read')
  async getState(
    @CurrentActor() actor: RequestActor,
    @Body() rawBody: EngagementStateInput,
    @Req() request: FastifyRequest,
  ) {
    const input = engagementStateInputSchema.parse(rawBody);
    return singleResponse(
      await this.engagement.getState(actor.userId, input),
      request.id,
    );
  }

  @Get('followed-creators')
  @RequireCapabilities('shopper:read')
  async listFollowedCreators(
    @CurrentActor() actor: RequestActor,
    @Query() rawQuery: unknown,
    @Req() request: FastifyRequest,
  ) {
    const query = engagementListQuerySchema.parse(rawQuery);
    const cursor = decodeEngagementCursor(query.cursor, 'followed-creators');
    const page = await this.engagement.listFollowedCreators(
      actor.userId,
      query.limit,
      cursor,
    );
    return collectionResponse(page.items, page.nextCursor, request.id);
  }

  @Put('followed-creators/:creatorId')
  @RequireCapabilities('shopper:save')
  @HttpCode(HttpStatus.NO_CONTENT)
  async followCreator(
    @CurrentActor() actor: RequestActor,
    @Param('creatorId') rawCreatorId: string,
  ): Promise<void> {
    const creatorId = idSchema.parse(rawCreatorId);
    if (!(await this.engagement.followCreator(actor.userId, creatorId))) {
      throw problem(404, 'RESOURCE_NOT_FOUND', 'Creator storefront not found');
    }
  }

  @Delete('followed-creators/:creatorId')
  @RequireCapabilities('shopper:save')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfollowCreator(
    @CurrentActor() actor: RequestActor,
    @Param('creatorId') rawCreatorId: string,
  ): Promise<void> {
    await this.engagement.unfollowCreator(actor.userId, idSchema.parse(rawCreatorId));
  }

  @Get('saved-products')
  @RequireCapabilities('shopper:read')
  async listSavedProducts(
    @CurrentActor() actor: RequestActor,
    @Query() rawQuery: unknown,
    @Req() request: FastifyRequest,
  ) {
    const query = engagementListQuerySchema.parse(rawQuery);
    const cursor = decodeEngagementCursor(query.cursor, 'saved-products');
    const page = await this.engagement.listSavedProducts(
      actor.userId,
      query.limit,
      cursor,
    );
    return collectionResponse(page.items, page.nextCursor, request.id);
  }

  @Put('saved-products/:productId')
  @RequireCapabilities('shopper:save')
  @HttpCode(HttpStatus.NO_CONTENT)
  async saveProduct(
    @CurrentActor() actor: RequestActor,
    @Param('productId') rawProductId: string,
    @Body() rawBody: SaveProductInput,
  ): Promise<void> {
    const productId = idSchema.parse(rawProductId);
    const input = saveProductInputSchema.parse(rawBody ?? {});
    if (!(await this.engagement.saveProduct(actor.userId, productId, input))) {
      throw problem(404, 'RESOURCE_NOT_FOUND', 'Product recommendation not found');
    }
  }

  @Delete('saved-products/:productId')
  @RequireCapabilities('shopper:save')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeSavedProduct(
    @CurrentActor() actor: RequestActor,
    @Param('productId') rawProductId: string,
  ): Promise<void> {
    await this.engagement.removeSavedProduct(actor.userId, idSchema.parse(rawProductId));
  }
}
