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
      service.replaceStorefrontConfiguration('user-id', 2, { categoryIds: [] }),
    ).rejects.toMatchObject({ response: { code: 'PRECONDITION_FAILED' } });
  });

  it('requires an approved creator for media-kit reads', async () => {
    const repository = { getMediaKit: vi.fn().mockResolvedValue(null) };
    const service = new CreatorStudioService(repository as never);

    await expect(service.mediaKit('user-id')).rejects.toMatchObject({
      response: { code: 'CAPABILITY_REQUIRED' },
    });
  });
});
