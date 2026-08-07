import { Injectable } from '@nestjs/common';
import {
  creatorDiscountCodeInputSchema,
  type CreatorDiscountCode,
  type CreatorDiscountCodeInput,
  type CreatorDiscountCodePatch,
} from '@vibeshub/contracts';

import { problem } from '../api-problem.js';
import { DiscountCodeRepository } from './discount-code.repository.js';

@Injectable()
export class DiscountCodeService {
  constructor(private readonly codes: DiscountCodeRepository) {}

  async create(
    userId: string,
    input: CreatorDiscountCodeInput,
  ): Promise<CreatorDiscountCode> {
    try {
      const created = await this.codes.create(userId, input);
      if (!created) throw this.creatorAccessRequired();
      return created;
    } catch (error) {
      this.translateError(error);
    }
  }

  async listOwned(userId: string): Promise<CreatorDiscountCode[]> {
    const codes = await this.codes.listOwned(userId);
    if (!codes) throw this.creatorAccessRequired();
    return codes;
  }

  async getOwned(id: string, userId: string): Promise<CreatorDiscountCode> {
    const code = await this.codes.findOwned(id, userId);
    if (!code) throw problem(404, 'RESOURCE_NOT_FOUND', 'Discount code not found');
    return code;
  }

  async update(
    id: string,
    userId: string,
    expectedVersion: number,
    patch: CreatorDiscountCodePatch,
  ): Promise<CreatorDiscountCode> {
    const current = await this.requireCurrentVersion(id, userId, expectedVersion);
    if (current.lifecycle === 'archived') {
      throw problem(409, 'INVALID_STATE_TRANSITION', 'Archived codes cannot be edited');
    }
    const input = creatorDiscountCodeInputSchema.parse({
      code: current.code,
      detailsHe: current.details?.value ?? null,
      expiresAt: current.expiresAt,
      label: current.label,
      merchantUrl: current.merchantUrl,
      startsAt: current.startsAt,
      ...patch,
    });
    try {
      const updated = await this.codes.replaceOwned(id, userId, expectedVersion, input);
      if (!updated) throw this.preconditionFailed();
      return updated;
    } catch (error) {
      this.translateError(error);
    }
  }

  async confirm(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<CreatorDiscountCode> {
    const current = await this.requireCurrentVersion(id, userId, expectedVersion);
    if (current.lifecycle === 'archived') {
      throw problem(
        409,
        'INVALID_STATE_TRANSITION',
        'Archived codes cannot be published',
      );
    }
    if (current.expiresAt && current.expiresAt <= new Date().toISOString()) {
      throw problem(
        409,
        'DISCOUNT_EXPIRED',
        'An expired discount code cannot be published',
      );
    }
    const confirmed = await this.codes.confirmOwned(id, userId, expectedVersion);
    if (!confirmed) throw this.preconditionFailed();
    return confirmed;
  }

  async hide(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<CreatorDiscountCode> {
    const current = await this.requireCurrentVersion(id, userId, expectedVersion);
    if (current.lifecycle !== 'published') {
      throw problem(
        409,
        'INVALID_STATE_TRANSITION',
        'Only published codes can be hidden',
      );
    }
    const hidden = await this.codes.transitionOwned(
      id,
      userId,
      expectedVersion,
      'hidden',
    );
    if (!hidden) throw this.preconditionFailed();
    return hidden;
  }

  async archive(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<CreatorDiscountCode> {
    const current = await this.requireCurrentVersion(id, userId, expectedVersion);
    if (current.lifecycle === 'archived') {
      throw problem(409, 'INVALID_STATE_TRANSITION', 'This code is already archived');
    }
    const archived = await this.codes.transitionOwned(
      id,
      userId,
      expectedVersion,
      'archived',
    );
    if (!archived) throw this.preconditionFailed();
    return archived;
  }

  private async requireCurrentVersion(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<CreatorDiscountCode> {
    const current = await this.getOwned(id, userId);
    if (current.version !== expectedVersion) throw this.preconditionFailed();
    return current;
  }

  private creatorAccessRequired() {
    return problem(403, 'CAPABILITY_REQUIRED', 'An approved creator profile is required');
  }

  private preconditionFailed() {
    return problem(
      412,
      'PRECONDITION_FAILED',
      'The discount code changed since it was loaded',
      'Reload the code and retry with its current version.',
    );
  }

  private translateError(error: unknown): never {
    if (
      error instanceof Error &&
      (error.message === 'UNSAFE_REDIRECT_DESTINATION' ||
        error.message === 'INVALID_MERCHANT_HOSTNAME')
    ) {
      throw problem(
        422,
        'UNSAFE_REDIRECT_DESTINATION',
        'Use a public HTTPS merchant or brand URL without credentials or a custom port',
      );
    }
    if (hasPostgresCode(error, '23505')) {
      throw problem(
        409,
        'RESOURCE_CONFLICT',
        'This creator already has that active code for this merchant',
      );
    }
    throw error;
  }
}

function hasPostgresCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
