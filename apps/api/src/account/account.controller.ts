import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { accountProfilePatchSchema, type AccountProfilePatch } from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';

import { CurrentActor } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { singleResponse } from '../http-response.js';
import { AccountRepository } from './account.repository.js';

@Controller('me')
export class AccountController {
  constructor(private readonly accounts: AccountRepository) {}

  @Get()
  async getAccount(@CurrentActor() actor: RequestActor, @Req() request: FastifyRequest) {
    return singleResponse(await this.accounts.getSummary(actor), request.id);
  }

  @Get('profile')
  async getProfile(@CurrentActor() actor: RequestActor, @Req() request: FastifyRequest) {
    return singleResponse(await this.accounts.getProfile(actor.userId), request.id);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentActor() actor: RequestActor,
    @Body() body: AccountProfilePatch,
    @Req() request: FastifyRequest,
  ) {
    const patch = accountProfilePatchSchema.parse(body);
    return singleResponse(
      await this.accounts.updateProfile(actor.userId, patch),
      request.id,
    );
  }
}
