import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import {
  creatorApplicationReviewInputSchema,
  type CreatorApplicationReviewInput,
} from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';

import { CurrentActor, RequireCapabilities } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { singleResponse } from '../http-response.js';
import { IdempotencyService } from '../idempotency.service.js';
import { ApplicationService } from './application.service.js';

@Controller('admin/creator-applications')
@RequireCapabilities('moderator:review_content')
export class AdminApplicationController {
  constructor(
    private readonly applications: ApplicationService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    return singleResponse(await this.applications.listForReview(), request.id);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() request: FastifyRequest) {
    return singleResponse(await this.applications.getForReview(id), request.id);
  }

  @Post(':id/start-review')
  startReview(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Body() body: CreatorApplicationReviewInput,
    @Headers('idempotency-key') header: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    return this.runDecision(id, actor, 'start-review', body, header, request, (input) =>
      this.applications.startReview(id, actor.userId, input),
    );
  }

  @Post(':id/request-changes')
  requestChanges(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Body() body: CreatorApplicationReviewInput,
    @Headers('idempotency-key') header: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    return this.runDecision(
      id,
      actor,
      'request-changes',
      body,
      header,
      request,
      (input) => this.applications.requestChanges(id, actor.userId, input),
    );
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Body() body: CreatorApplicationReviewInput,
    @Headers('idempotency-key') header: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    return this.runDecision(id, actor, 'approve', body, header, request, (input) =>
      this.applications.approve(id, actor.userId, input),
    );
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentActor() actor: RequestActor,
    @Body() body: CreatorApplicationReviewInput,
    @Headers('idempotency-key') header: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    return this.runDecision(id, actor, 'reject', body, header, request, (input) =>
      this.applications.reject(id, actor.userId, input),
    );
  }

  private async runDecision(
    id: string,
    actor: RequestActor,
    command: string,
    body: CreatorApplicationReviewInput,
    header: string | undefined,
    request: FastifyRequest,
    handler: (
      input: CreatorApplicationReviewInput,
    ) => ReturnType<ApplicationService['approve']>,
  ) {
    const input = creatorApplicationReviewInputSchema.parse(body);
    const key = this.idempotency.requireKey(header);
    const data = await this.idempotency.execute(
      actor.userId,
      `admin.creator-applications.${id}.${command}`,
      key,
      input,
      () => handler(input),
    );
    return singleResponse(data, request.id);
  }
}
