import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StoryVideoUpload } from '@vibeshub/contracts';

import { uploadVideoResumable } from './recommendation-media';

vi.mock('./config', () => ({
  getSupabasePublicConfig: () => ({
    url: 'https://example.supabase.co',
    publishableKey: 'test',
  }),
}));

afterEach(() => vi.unstubAllGlobals());

describe('resumable video upload', () => {
  it('sends signed six-megabyte chunks and reports completion', async () => {
    const size = 7 * 1024 * 1024;
    const file = new File([new Uint8Array(size)], 'clip.mov', {
      type: 'video/quicktime',
    });
    const upload: StoryVideoUpload = {
      assetId: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
      bucket: 'story-video-uploads',
      contentType: 'video/quicktime',
      expiresAt: '2026-10-06T00:00:00.000Z',
      objectPath: 'creator/clip.mov',
      token: 'signed-token',
    };
    const requests: Array<{ url: string; method: string; headers: Headers }> = [];
    let offset = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL, init: RequestInit) => {
        const headers = new Headers(init.headers);
        requests.push({ url: String(url), method: init.method ?? 'GET', headers });
        if (init.method === 'POST')
          return new Response(null, {
            status: 201,
            headers: { Location: '/storage/v1/upload/resumable/clip' },
          });
        offset += (init.body as Blob).size;
        return new Response(null, {
          status: 204,
          headers: { 'Upload-Offset': String(offset) },
        });
      }),
    );
    const progress: number[] = [];

    await uploadVideoResumable(file, upload, (_stage, percent) => {
      if (percent !== undefined) progress.push(percent);
    });

    expect(requests.map((request) => request.method)).toEqual(['POST', 'PATCH', 'PATCH']);
    expect(requests[0]?.url).toContain('example.storage.supabase.co');
    expect(requests[0]?.headers.get('apikey')).toBe('test');
    expect(requests[1]?.headers.get('x-signature')).toBe('signed-token');
    expect(requests[2]?.headers.get('Upload-Offset')).toBe(String(6 * 1024 * 1024));
    expect(progress.at(-1)).toBe(100);
  });

  it('continues after an interrupted chunk at the server offset', async () => {
    const file = new File([new Uint8Array(1024)], 'clip.mp4', { type: 'video/mp4' });
    const upload: StoryVideoUpload = {
      assetId: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
      bucket: 'story-video-uploads',
      contentType: 'video/mp4',
      expiresAt: '2026-10-06T00:00:00.000Z',
      objectPath: 'creator/clip.mp4',
      token: 'signed-token',
    };
    let patches = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: URL, init: RequestInit) => {
        if (init.method === 'POST')
          return new Response(null, {
            status: 201,
            headers: { Location: '/resumable/clip' },
          });
        if (init.method === 'HEAD')
          return new Response(null, { status: 200, headers: { 'Upload-Offset': '0' } });
        patches += 1;
        if (patches === 1) throw new Error('connection dropped');
        return new Response(null, { status: 204, headers: { 'Upload-Offset': '1024' } });
      }),
    );

    await uploadVideoResumable(file, upload, () => undefined);
    expect(patches).toBe(2);
  });

  it('explains when storage rejects an upload for its size', async () => {
    const file = new File([new Uint8Array(1024)], 'clip.mov', {
      type: 'video/quicktime',
    });
    const upload: StoryVideoUpload = {
      assetId: '01989f72-07e4-7f32-9b42-1ba55d4ca010',
      bucket: 'story-video-uploads',
      contentType: 'video/quicktime',
      expiresAt: '2026-10-06T00:00:00.000Z',
      objectPath: 'creator/clip.mov',
      token: 'signed-token',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('too large', { status: 413 })),
    );
    await expect(uploadVideoResumable(file, upload, () => undefined)).rejects.toThrow(
      'storage size limit',
    );
  });
});
