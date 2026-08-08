import { Body, Controller, Get, Headers, Patch, Req } from '@nestjs/common';
import { creatorProfilePatchSchema, type CreatorProfilePatch } from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';

import { CurrentActor, RequireCapabilities } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { singleResponse } from '../http-response.js';
import { parseIfMatch } from '../recommendations/recommendation.js';
import { CreatorProfileService } from './creator-profile.service.js';

@Controller('creator/profile')
@RequireCapabilities('creator:manage_profile')
export class CreatorProfileController {
  constructor(private readonly profiles: CreatorProfileService) {}

  @Get()
  async get(@CurrentActor() actor: RequestActor, @Req() request: FastifyRequest) {
    return singleResponse(await this.profiles.get(actor.userId), request.id);
  }

  @Patch()
  async update(
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: CreatorProfilePatch,
    @Req() request: FastifyRequest,
  ) {
    const patch = creatorProfilePatchSchema.parse(body);
    return singleResponse(
      await this.profiles.update(actor.userId, parseIfMatch(ifMatch), patch),
      request.id,
    );
  }
}
