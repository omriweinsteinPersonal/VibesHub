import { Body, Controller, Headers, Param, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

import { CurrentActor, RequireCapabilities } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { singleResponse } from '../http-response.js';
import { IdempotencyService } from '../idempotency.service.js';
import { MerchantDomainService } from './merchant-domain.service.js';

const merchantDomainInputSchema = z
  .object({
    allowImport: z.boolean().default(false),
    allowRedirect: z.boolean().default(false),
    hostname: z.string().trim().min(4).max(253),
  })
  .strict();

@Controller('admin/merchants')
@RequireCapabilities('admin:manage_platform')
export class AdminMerchantDomainController {
  constructor(
    private readonly domains: MerchantDomainService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post(':merchantId/domains')
  async upsert(
    @Param('merchantId') rawMerchantId: string,
    @Body() body: unknown,
    @CurrentActor() actor: RequestActor,
    @Headers('idempotency-key') header: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const merchantId = z.uuid().parse(rawMerchantId);
    const input = merchantDomainInputSchema.parse(body);
    const key = this.idempotency.requireKey(header);
    const domain = await this.idempotency.execute(
      actor.userId,
      `admin.merchants.${merchantId}.domains`,
      key,
      input,
      () => this.domains.upsert(merchantId, actor.userId, input),
    );
    return singleResponse(domain, request.id);
  }
}
