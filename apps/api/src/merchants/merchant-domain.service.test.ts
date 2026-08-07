import type { MerchantDomainReviewItem } from '@vibeshub/contracts';
import { describe, expect, it, vi } from 'vitest';

import { ApiProblem } from '../api-problem.js';
import { MerchantDomainService } from './merchant-domain.service.js';
import type { MerchantDomainRepository } from './merchant-domain.repository.js';

const item: MerchantDomainReviewItem = {
  allowImport: false,
  allowRedirect: true,
  createdAt: '2026-08-07T10:00:00.000Z',
  creatorCount: 1,
  hostname: 'shop.example.com',
  id: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
  latestRecommendationAt: '2026-08-07T10:00:00.000Z',
  merchant: {
    homepageUrl: 'https://shop.example.com',
    id: '01989f72-07e4-7f32-9b42-1ba55d4ca011',
    name: 'Example Shop',
    status: 'active',
  },
  recommendationCount: 1,
  reviewedAt: '2026-08-07T10:05:00.000Z',
  reviewedByUserId: '01989f72-07e4-7f32-9b42-1ba55d4ca012',
  reviewNote: null,
  reviewStatus: 'approved',
  updatedAt: '2026-08-07T10:05:00.000Z',
  verifiedAt: '2026-08-07T10:05:00.000Z',
  version: 2,
};

describe('MerchantDomainService', () => {
  it('returns the freshly hydrated domain after approval', async () => {
    const repository = {
      approve: vi.fn().mockResolvedValue({ kind: 'changed' }),
      findById: vi.fn().mockResolvedValue(item),
    } as unknown as MerchantDomainRepository;
    const service = new MerchantDomainService(repository);

    await expect(
      service.approve(item.id, item.reviewedByUserId!, 1, {
        allowImport: false,
        allowRedirect: true,
      }),
    ).resolves.toEqual(item);
  });

  it('surfaces stale administrator decisions as a precondition failure', async () => {
    const repository = {
      approve: vi.fn().mockResolvedValue({ actualVersion: 3, kind: 'version_conflict' }),
    } as unknown as MerchantDomainRepository;
    const service = new MerchantDomainService(repository);

    try {
      await service.approve(item.id, item.reviewedByUserId!, 1, {
        allowImport: false,
        allowRedirect: true,
      });
      expect.unreachable('approval should fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiProblem);
      expect((error as ApiProblem).getStatus()).toBe(412);
    }
  });
});
