import { describe, expect, it, vi } from 'vitest';

import { MediaRepository } from './media.repository.js';

describe('account media cleanup', () => {
  it('keeps the database transaction open until storage cleanup completes', async () => {
    const assets = [{ mediaKind: 'recommendation_image', objectPath: 'a/image.webp' }];
    const events: string[] = [];
    const transaction = vi.fn().mockResolvedValue(assets);
    const begin = vi.fn(async (work: (tx: typeof transaction) => Promise<void>) => {
      events.push('begin');
      await work(transaction);
      events.push('commit');
    });
    const repository = new MediaRepository({ sql: { begin } } as never);

    await repository.deleteUnreferenced(['asset-id'], (items) => {
      expect(items).toEqual(assets);
      events.push('storage');
      return Promise.resolve();
    });

    expect(events).toEqual(['begin', 'storage', 'commit']);
  });

  it('propagates storage failure so the transaction can roll back', async () => {
    const transaction = vi
      .fn()
      .mockResolvedValue([{ mediaKind: 'story_video', objectPath: 'a/video.mp4' }]);
    const begin = vi.fn((work: (tx: typeof transaction) => Promise<void>) =>
      work(transaction),
    );
    const repository = new MediaRepository({ sql: { begin } } as never);

    await expect(
      repository.deleteUnreferenced(['asset-id'], () =>
        Promise.reject(new Error('storage unavailable')),
      ),
    ).rejects.toThrow('storage unavailable');
  });
});
