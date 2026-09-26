import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { creatorBrandInputSchema, type CreatorBrandInput } from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';
import { CurrentActor, RequireCapabilities } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { singleResponse } from '../http-response.js';
import { parseIfMatch } from '../recommendations/recommendation.js';
import { CreatorBrandService } from './creator-brand.service.js';

@Controller('creator/brands')
@RequireCapabilities('creator:manage_profile')
export class CreatorBrandController {
  constructor(private readonly brands: CreatorBrandService) {}
  @Get() async list(@CurrentActor() actor: RequestActor, @Req() request: FastifyRequest) {
    return singleResponse(await this.brands.list(actor.userId), request.id);
  }
  @Post() async create(
    @CurrentActor() actor: RequestActor,
    @Body() body: CreatorBrandInput,
    @Req() request: FastifyRequest,
  ) {
    return singleResponse(
      await this.brands.create(actor.userId, creatorBrandInputSchema.parse(body)),
      request.id,
    );
  }
  @Patch(':id') async update(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') match: string | undefined,
    @Body() body: CreatorBrandInput,
    @Req() request: FastifyRequest,
  ) {
    return singleResponse(
      await this.brands.update(
        id,
        actor.userId,
        parseIfMatch(match),
        creatorBrandInputSchema.parse(body),
      ),
      request.id,
    );
  }
  @Delete(':id') async archive(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') match: string | undefined,
    @Query('archiveRecommendations') archiveRecommendations: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    await this.brands.archive(
      id,
      actor.userId,
      parseIfMatch(match),
      archiveRecommendations === 'true',
    );
    return singleResponse({ deleted: true }, request.id);
  }
}
