import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  creatorCardSchema,
  creatorApplicationInputSchema,
  creatorApplicationPatchSchema,
  type CreatorApplicationInput,
  type CreatorApplicationPatch,
} from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';

import { CurrentActor } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { singleResponse } from '../http-response.js';
import { IdempotencyService } from '../idempotency.service.js';
import { ApplicationService } from './application.service.js';

@Controller('creator-applications')
export class ApplicationController {
  constructor(
    private readonly applications: ApplicationService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post()
  async create(
    @CurrentActor() actor: RequestActor,
    @Body() body: CreatorApplicationInput,
    @Headers('idempotency-key') header: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const input = creatorApplicationInputSchema.parse(body);
    const key = this.idempotency.requireKey(header);
    const data = await this.idempotency.execute(
      actor.userId,
      'creator-applications.create',
      key,
      input,
      () => this.applications.create(actor.userId, input),
    );
    return singleResponse(data, request.id);
  }

  @Get('current')
  async getCurrent(@CurrentActor() actor: RequestActor, @Req() request: FastifyRequest) {
    return singleResponse(await this.applications.getCurrent(actor.userId), request.id);
  }

  @Get('handle-availability')
  async handleAvailability(
    @CurrentActor() actor: RequestActor,
    @Query('handle') rawHandle: string,
    @Req() request: FastifyRequest,
  ) {
    const handle = creatorCardSchema.shape.handle.parse(rawHandle);
    return singleResponse(
      await this.applications.handleAvailability(actor.userId, handle),
      request.id,
    );
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Body() body: CreatorApplicationPatch,
    @Req() request: FastifyRequest,
  ) {
    const input = creatorApplicationPatchSchema.parse(body);
    return singleResponse(
      await this.applications.update(id, actor.userId, input),
      request.id,
    );
  }

  @Post(':id/submit')
  async submit(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Headers('idempotency-key') header: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const key = this.idempotency.requireKey(header);
    const data = await this.idempotency.execute(
      actor.userId,
      `creator-applications.${id}.submit`,
      key,
      { id },
      () => this.applications.submit(id, actor.userId),
    );
    return singleResponse(data, request.id);
  }

  @Post(':id/withdraw')
  async withdraw(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Headers('idempotency-key') header: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const key = this.idempotency.requireKey(header);
    const data = await this.idempotency.execute(
      actor.userId,
      `creator-applications.${id}.withdraw`,
      key,
      { id },
      () => this.applications.withdraw(id, actor.userId),
    );
    return singleResponse(data, request.id);
  }
}
