import { Injectable } from '@nestjs/common';

import { problem } from '../api-problem.js';
import { normalizeMerchantHostname } from '../redirects/redirect-destination.js';
import {
  MerchantDomainRepository,
  type MerchantDomainInput,
  type MerchantDomainRecord,
} from './merchant-domain.repository.js';

@Injectable()
export class MerchantDomainService {
  constructor(private readonly domains: MerchantDomainRepository) {}

  async upsert(
    merchantId: string,
    actorUserId: string,
    input: MerchantDomainInput,
  ): Promise<MerchantDomainRecord> {
    try {
      const domain = await this.domains.upsert(merchantId, actorUserId, {
        ...input,
        hostname: normalizeMerchantHostname(input.hostname),
      });
      if (!domain) throw problem(404, 'RESOURCE_NOT_FOUND', 'Merchant not found');
      return domain;
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_MERCHANT_HOSTNAME') {
        throw problem(422, 'VALIDATION_FAILED', 'Enter a valid public merchant hostname');
      }
      if (error instanceof Error && error.message === 'MERCHANT_DOMAIN_CONFLICT') {
        throw problem(
          409,
          'RESOURCE_CONFLICT',
          'That hostname already belongs to another merchant',
        );
      }
      throw error;
    }
  }
}
