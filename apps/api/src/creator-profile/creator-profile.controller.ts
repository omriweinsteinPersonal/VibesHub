import { Body, Controller, Get, Headers, Patch, Query, Req } from '@nestjs/common';
import {
  creatorCardSchema,
  creatorProfilePatchSchema,
  type CreatorProfilePatch,
} from '@vibeshub/contracts';
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

  @Get('handle-availability')
  async handleAvailability(
    @CurrentActor() actor: RequestActor,
    @Query('handle') rawHandle: string,
    @Req() request: FastifyRequest,
  ) {
    const handle = creatorCardSchema.shape.handle.parse(rawHandle);
    return singleResponse(
      await this.profiles.handleAvailability(actor.userId, handle),
      request.id,
    );
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
