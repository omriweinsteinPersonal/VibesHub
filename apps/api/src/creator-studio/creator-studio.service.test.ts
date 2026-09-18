import { describe, expect, it, vi } from 'vitest';

import { CreatorStudioService } from './creator-studio.service.js';

describe('CreatorStudioService', () => {
  it('rejects stale storefront configuration writes', async () => {
    const repository = {
      replaceStorefrontConfiguration: vi
        .fn()
        .mockResolvedValue({ actualVersion: 3, kind: 'version_conflict' }),
    };
    const service = new CreatorStudioService(repository as never);

    await expect(
      service.replaceStorefrontConfiguration('user-id', 2, {
        categoryIds: [],
        curatedSections: [],
      }),
    ).rejects.toMatchObject({ response: { code: 'PRECONDITION_FAILED' } });
  });

  it('rejects recommendations outside the creator inventory', async () => {
    const repository = {
      replaceStorefrontConfiguration: vi.fn().mockResolvedValue({
        kind: 'invalid_recommendations',
      }),
    };
    const service = new CreatorStudioService(repository as never);
    await expect(
      service.replaceStorefrontConfiguration('user-id', 1, {
        categoryIds: [],
        curatedSections: [],
      }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_FAILED' } });
  });

  it('requires an approved creator for media-kit reads', async () => {
    const repository = { getMediaKit: vi.fn().mockResolvedValue(null) };
    const service = new CreatorStudioService(repository as never);

    await expect(service.mediaKit('user-id')).rejects.toMatchObject({
      response: { code: 'CAPABILITY_REQUIRED' },
    });
  });
});
