import { Body, Controller, Get, Headers, Put, Req } from '@nestjs/common';
import {
  creatorMediaKitInputSchema,
  creatorStorefrontConfigurationInputSchema,
  type CreatorMediaKitInput,
  type CreatorStorefrontConfigurationInput,
} from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';

import { CurrentActor, RequireCapabilities } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { singleResponse } from '../http-response.js';
import { parseIfMatch } from '../recommendations/recommendation.js';
import { CreatorStudioService } from './creator-studio.service.js';

@Controller('creator/studio')
@RequireCapabilities('creator:manage_profile')
export class CreatorStudioController {
  constructor(private readonly studio: CreatorStudioService) {}

  @Get()
  async summary(@CurrentActor() actor: RequestActor, @Req() request: FastifyRequest) {
    return singleResponse(await this.studio.summary(actor.userId), request.id);
  }

  @Get('storefront-sections')
  async sections(@CurrentActor() actor: RequestActor, @Req() request: FastifyRequest) {
    return singleResponse(
      await this.studio.storefrontConfiguration(actor.userId),
      request.id,
    );
  }

  @Put('storefront-sections')
  async replaceSections(
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: CreatorStorefrontConfigurationInput,
    @Req() request: FastifyRequest,
  ) {
    const input = creatorStorefrontConfigurationInputSchema.parse(body);
    return singleResponse(
      await this.studio.replaceStorefrontConfiguration(
        actor.userId,
        parseIfMatch(ifMatch),
        input,
      ),
      request.id,
    );
  }

  @Get('media-kit')
  async mediaKit(@CurrentActor() actor: RequestActor, @Req() request: FastifyRequest) {
    return singleResponse(await this.studio.mediaKit(actor.userId), request.id);
  }

  @Put('media-kit')
  async replaceMediaKit(
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: CreatorMediaKitInput,
    @Req() request: FastifyRequest,
  ) {
    const input = creatorMediaKitInputSchema.parse(body);
    return singleResponse(
      await this.studio.replaceMediaKit(actor.userId, parseIfMatch(ifMatch), input),
      request.id,
    );
  }
}
