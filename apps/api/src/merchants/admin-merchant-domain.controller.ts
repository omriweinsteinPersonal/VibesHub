import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import {
  idSchema,
  merchantDomainApprovalInputSchema,
  merchantDomainQueueQuerySchema,
  merchantDomainReasonInputSchema,
} from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

import { problem } from '../api-problem.js';
import { CurrentActor, RequireCapabilities } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { collectionResponse, singleResponse } from '../http-response.js';
import { IdempotencyService } from '../idempotency.service.js';
import { MerchantDomainService } from './merchant-domain.service.js';

const versionSchema = z.coerce.number().int().positive();

@Controller('admin/merchant-domains')
@RequireCapabilities('admin:manage_platform')
export class AdminMerchantDomainController {
  constructor(
    private readonly domains: MerchantDomainService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  async list(@Query() rawQuery: unknown, @Req() request: FastifyRequest) {
    const query = merchantDomainQueueQuerySchema.parse(rawQuery);
    const page = await this.domains.list(query);
    return collectionResponse(page.items, page.nextCursor, request.id);
  }

  @Post(':id/approve')
  approve(
    @Param('id') rawId: string,
    @Body() body: unknown,
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const input = merchantDomainApprovalInputSchema.parse(body);
    return this.runDecision(
      idSchema.parse(rawId),
      'approve',
      actor,
      this.requireVersion(ifMatch),
      input,
      idempotencyKey,
      request,
      (id, version) => this.domains.approve(id, actor.userId, version, input),
    );
  }

  @Post(':id/reject')
  reject(
    @Param('id') rawId: string,
    @Body() body: unknown,
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const input = merchantDomainReasonInputSchema.parse(body);
    return this.runDecision(
      idSchema.parse(rawId),
      'reject',
      actor,
      this.requireVersion(ifMatch),
      input,
      idempotencyKey,
      request,
      (id, version) => this.domains.reject(id, actor.userId, version, input),
    );
  }

  @Post(':id/disable')
  disable(
    @Param('id') rawId: string,
    @Body() body: unknown,
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const input = merchantDomainReasonInputSchema.parse(body);
    return this.runDecision(
      idSchema.parse(rawId),
      'disable',
      actor,
      this.requireVersion(ifMatch),
      input,
      idempotencyKey,
      request,
      (id, version) => this.domains.disable(id, actor.userId, version, input),
    );
  }

  private async runDecision<T>(
    id: string,
    command: string,
    actor: RequestActor,
    expectedVersion: number,
    input: T,
    header: string | undefined,
    request: FastifyRequest,
    handler: (
      id: string,
      version: number,
    ) => ReturnType<MerchantDomainService['approve']>,
  ) {
    const key = this.idempotency.requireKey(header);
    const data = await this.idempotency.execute(
      actor.userId,
      `admin.merchant-domains.${id}.${command}`,
      key,
      { expectedVersion, input },
      () => handler(id, expectedVersion),
    );
    return singleResponse(data, request.id);
  }

  private requireVersion(value: string | undefined): number {
    if (!value) {
      throw problem(
        428,
        'PRECONDITION_REQUIRED',
        'An If-Match version is required for review decisions',
      );
    }
    const parsed = versionSchema.safeParse(value.replaceAll('"', ''));
    if (!parsed.success) {
      throw problem(422, 'VALIDATION_FAILED', 'The If-Match version is invalid');
    }
    return parsed.data;
  }
}
