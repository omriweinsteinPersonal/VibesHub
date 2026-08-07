import { Injectable } from '@nestjs/common';
import type {
  MerchantDomainApprovalInput,
  MerchantDomainQueueQuery,
  MerchantDomainReasonInput,
  MerchantDomainReviewItem,
} from '@vibeshub/contracts';

import { problem } from '../api-problem.js';
import {
  decodeMerchantDomainQueueCursor,
  encodeMerchantDomainQueueCursor,
} from './merchant-domain.js';
import {
  MerchantDomainRepository,
  type MerchantDomainRepositoryPort,
  type MerchantDomainTransitionResult,
} from './merchant-domain.repository.js';

@Injectable()
export class MerchantDomainService {
  constructor(private readonly domains: MerchantDomainRepository) {}

  async list(query: MerchantDomainQueueQuery): Promise<{
    items: MerchantDomainReviewItem[];
    nextCursor: string | null;
  }> {
    const cursor = decodeMerchantDomainQueueCursor(query.cursor, query.status);
    const page = await this.domains.list(query, cursor);
    return {
      items: page.items,
      nextCursor: page.nextCursor
        ? encodeMerchantDomainQueueCursor(page.nextCursor)
        : null,
    };
  }

  approve(
    id: string,
    actorUserId: string,
    expectedVersion: number,
    input: MerchantDomainApprovalInput,
  ): Promise<MerchantDomainReviewItem> {
    return this.decide(id, () =>
      this.repository.approve(id, actorUserId, expectedVersion, input),
    );
  }

  reject(
    id: string,
    actorUserId: string,
    expectedVersion: number,
    input: MerchantDomainReasonInput,
  ): Promise<MerchantDomainReviewItem> {
    return this.decide(id, () =>
      this.repository.reject(id, actorUserId, expectedVersion, input),
    );
  }

  disable(
    id: string,
    actorUserId: string,
    expectedVersion: number,
    input: MerchantDomainReasonInput,
  ): Promise<MerchantDomainReviewItem> {
    return this.decide(id, () =>
      this.repository.disable(id, actorUserId, expectedVersion, input),
    );
  }

  private get repository(): MerchantDomainRepositoryPort {
    return this.domains;
  }

  private async decide(
    id: string,
    transition: () => Promise<MerchantDomainTransitionResult>,
  ): Promise<MerchantDomainReviewItem> {
    const result = await transition();
    if (result.kind === 'not_found') {
      throw problem(404, 'RESOURCE_NOT_FOUND', 'Merchant domain not found');
    }
    if (result.kind === 'version_conflict') {
      throw problem(
        412,
        'VERSION_CONFLICT',
        'This merchant domain changed while you were reviewing it',
        `Reload the queue and retry from version ${result.actualVersion}.`,
      );
    }
    if (result.kind === 'invalid_state') {
      throw problem(
        409,
        'INVALID_STATE_TRANSITION',
        'This review action is no longer available',
        `The merchant domain is currently ${result.status}.`,
      );
    }
    const item = await this.repository.findById(id);
    if (!item) throw problem(404, 'RESOURCE_NOT_FOUND', 'Merchant domain not found');
    return item;
  }
}
