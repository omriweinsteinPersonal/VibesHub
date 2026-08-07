import { Body, Controller, Get, Headers, Param, Patch, Post, Req } from '@nestjs/common';
import {
  creatorDiscountCodeInputSchema,
  creatorDiscountCodePatchSchema,
  type CreatorDiscountCodeInput,
  type CreatorDiscountCodePatch,
} from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';

import { CurrentActor, RequireCapabilities } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { collectionResponse, singleResponse } from '../http-response.js';
import { IdempotencyService } from '../idempotency.service.js';
import { parseIfMatch } from '../recommendations/recommendation.js';
import { DiscountCodeService } from './discount-code.service.js';

@Controller('creator/discount-codes')
@RequireCapabilities('creator:manage_content')
export class CreatorDiscountCodesController {
  constructor(
    private readonly codes: DiscountCodeService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  async list(@CurrentActor() actor: RequestActor, @Req() request: FastifyRequest) {
    return collectionResponse(await this.codes.listOwned(actor.userId), null, request.id);
  }

  @Post()
  async create(
    @CurrentActor() actor: RequestActor,
    @Body() body: CreatorDiscountCodeInput,
    @Headers('idempotency-key') header: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const input = creatorDiscountCodeInputSchema.parse(body);
    const key = this.idempotency.requireKey(header);
    const code = await this.idempotency.execute(
      actor.userId,
      'creator-discount-codes.create',
      key,
      input,
      () => this.codes.create(actor.userId, input),
    );
    return singleResponse(code, request.id);
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Req() request: FastifyRequest,
  ) {
    return singleResponse(await this.codes.getOwned(id, actor.userId), request.id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: CreatorDiscountCodePatch,
    @Req() request: FastifyRequest,
  ) {
    const patch = creatorDiscountCodePatchSchema.parse(body);
    return singleResponse(
      await this.codes.update(id, actor.userId, parseIfMatch(ifMatch), patch),
      request.id,
    );
  }

  @Post(':id/confirm')
  confirm(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    return this.transition('confirm', id, actor, ifMatch, key, request);
  }

  @Post(':id/hide')
  hide(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    return this.transition('hide', id, actor, ifMatch, key, request);
  }

  @Post(':id/archive')
  archive(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    return this.transition('archive', id, actor, ifMatch, key, request);
  }

  private async transition(
    command: 'archive' | 'confirm' | 'hide',
    id: string,
    actor: RequestActor,
    ifMatch: string | undefined,
    idempotencyHeader: string | undefined,
    request: FastifyRequest,
  ) {
    const version = parseIfMatch(ifMatch);
    const key = this.idempotency.requireKey(idempotencyHeader);
    const code = await this.idempotency.execute(
      actor.userId,
      `creator-discount-codes.${id}.${command}`,
      key,
      { id, version },
      () => this.codes[command](id, actor.userId, version),
    );
    return singleResponse(code, request.id);
  }
}
