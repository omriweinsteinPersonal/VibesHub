import { describe, expect, it, vi } from 'vitest';

import type { MediaAssetRow } from './media.repository.js';
import { MediaService } from './media.service.js';

const pendingAsset: MediaAssetRow = {
  contentType: 'image/png',
  declaredSizeBytes: '8',
  id: '01989f72-07e4-7f32-9b42-1ba55d4ca011',
  objectPath:
    '01989f72-07e4-7f32-9b42-1ba55d4ca010/01989f72-07e4-7f32-9b42-1ba55d4ca011.png',
  publicUrl: null,
  sizeBytes: null,
  status: 'pending_upload',
  version: 1,
};

describe('MediaService', () => {
  it('publishes validated bytes before making an asset ready', async () => {
    const readyAsset: MediaAssetRow = {
      ...pendingAsset,
      publicUrl:
        'https://project.supabase.co/storage/v1/object/public/recommendation-images/image.png',
      sizeBytes: '8',
      status: 'ready',
      version: 2,
    };
    const media = {
      findOwned: vi.fn().mockResolvedValue(pendingAsset),
      markReady: vi.fn().mockResolvedValue(readyAsset),
    };
    const storage = {
      downloadUpload: vi
        .fn()
        .mockResolvedValue(
          new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]),
        ),
      publicUrl: vi.fn().mockReturnValue(readyAsset.publicUrl),
      publishVerified: vi.fn().mockResolvedValue(undefined),
      removeUpload: vi.fn().mockResolvedValue(undefined),
    };
    const service = new MediaService(media as never, storage as never);

    await expect(
      service.completeImageUpload(
        '01989f72-07e4-7f32-9b42-1ba55d4ca010',
        pendingAsset.id,
      ),
    ).resolves.toMatchObject({ id: pendingAsset.id, status: 'ready' });

    expect(storage.publishVerified).toHaveBeenCalledWith(
      pendingAsset.objectPath,
      'image/png',
      expect.any(Blob),
    );
    expect(media.markReady).toHaveBeenCalledOnce();
    expect(storage.publishVerified.mock.invocationCallOrder[0]).toBeLessThan(
      media.markReady.mock.invocationCallOrder[0] ?? 0,
    );
    expect(storage.removeUpload).toHaveBeenCalledWith(pendingAsset.objectPath);
  });

  it('rejects mismatched bytes and removes them from quarantine', async () => {
    const media = {
      findOwned: vi.fn().mockResolvedValue(pendingAsset),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const storage = {
      downloadUpload: vi
        .fn()
        .mockResolvedValue(
          new Blob([Uint8Array.from([0x3c, 0x73, 0x76, 0x67, 0, 0, 0, 0])]),
        ),
      removeUpload: vi.fn().mockResolvedValue(undefined),
    };
    const service = new MediaService(media as never, storage as never);

    await expect(
      service.completeImageUpload(
        '01989f72-07e4-7f32-9b42-1ba55d4ca010',
        pendingAsset.id,
      ),
    ).rejects.toMatchObject({ response: { code: 'UNSUPPORTED_MEDIA_TYPE' } });

    expect(storage.removeUpload).toHaveBeenCalledWith(pendingAsset.objectPath);
    expect(media.markFailed).toHaveBeenCalledWith(
      pendingAsset.id,
      '01989f72-07e4-7f32-9b42-1ba55d4ca010',
      'invalid_content',
    );
  });
});
