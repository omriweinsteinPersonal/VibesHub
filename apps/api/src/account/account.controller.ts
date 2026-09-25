import { Controller, Get, Req } from '@nestjs/common';
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
}
