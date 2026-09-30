import { Controller, Get, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { CurrentActor, Public, RequireCapabilities } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { singleResponse } from '../http-response.js';
import { BillingService } from './billing.service.js';

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('billing')
  @RequireCapabilities('creator:manage_profile')
  async getSummary(@CurrentActor() actor: RequestActor, @Req() request: FastifyRequest) {
    return singleResponse(await this.billing.getSummary(actor.userId), request.id);
  }

  @Post('webhooks/revenuecat')
  @Public()
  @HttpCode(204)
  async revenueCatWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-revenuecat-webhook-signature') signature: string | undefined,
    @Req() request: RawBodyRequest<FastifyRequest>,
  ): Promise<void> {
    await this.billing.handleRevenueCatWebhook({
      authorization,
      rawBody: request.rawBody,
      signature,
    });
  }
}
