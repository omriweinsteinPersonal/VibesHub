import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  idSchema,
  recommendationImageUploadInputSchema,
  type RecommendationImageUploadInput,
} from '@vibeshub/contracts';
import type { FastifyRequest } from 'fastify';

import { CurrentActor, RequireCapabilities } from '../auth/auth.decorators.js';
import type { RequestActor } from '../auth/auth.types.js';
import { singleResponse } from '../http-response.js';
import { IdempotencyService } from '../idempotency.service.js';
import { MediaService } from './media.service.js';

@Controller('creator/media/images')
@RequireCapabilities('creator:manage_content')
export class CreatorMediaController {
  constructor(
    private readonly media: MediaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post('uploads')
  async createUpload(
    @CurrentActor() actor: RequestActor,
    @Body() body: RecommendationImageUploadInput,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const input = recommendationImageUploadInputSchema.parse(body);
    const key = this.idempotency.requireKey(idempotencyHeader);
    const data = await this.idempotency.execute(
      actor.userId,
      'creator-media.image-upload.create',
      key,
      input,
      () => this.media.createImageUpload(actor.userId, input),
    );
    return singleResponse(data, request.id);
  }

  @Post(':id/complete')
  async completeUpload(
    @Param('id') rawId: string,
    @CurrentActor() actor: RequestActor,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const id = idSchema.parse(rawId);
    const key = this.idempotency.requireKey(idempotencyHeader);
    const data = await this.idempotency.execute(
      actor.userId,
      `creator-media.image-upload.${id}.complete`,
      key,
      { id },
      () => this.media.completeImageUpload(actor.userId, id),
    );
    return singleResponse(data, request.id);
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteImage(
    @Param('id') rawId: string,
    @CurrentActor() actor: RequestActor,
  ): Promise<void> {
    await this.media.deleteImage(actor.userId, idSchema.parse(rawId));
  }
}
