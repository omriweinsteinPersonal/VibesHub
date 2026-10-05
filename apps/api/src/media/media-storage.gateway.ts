import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  RecommendationImageContentType,
  StoryVideoContentType,
} from '@vibeshub/contracts';

import { parseApiConfig } from '../config.js';
import type { AccountMediaAsset } from './media.repository.js';
import {
  RECOMMENDATION_IMAGE_BUCKET,
  RECOMMENDATION_IMAGE_UPLOAD_BUCKET,
} from './image-media.js';
import { STORY_VIDEO_BUCKET, STORY_VIDEO_UPLOAD_BUCKET } from './video-media.js';

@Injectable()
export class MediaStorageGateway {
  private readonly client: SupabaseClient | null;
  private readonly storageUrl: string | null;
  private readonly serviceKey: string | null;

  constructor() {
    const config = parseApiConfig(process.env);
    this.storageUrl = config.supabaseUrl ?? null;
    this.serviceKey = config.supabaseServiceRoleKey ?? null;
    this.client =
      config.supabaseUrl && config.supabaseServiceRoleKey
        ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
            auth: {
              autoRefreshToken: false,
              detectSessionInUrl: false,
              persistSession: false,
            },
          })
        : null;
  }

  async createSignedUpload(objectPath: string): Promise<string> {
    return this.createSignedUploadFor(RECOMMENDATION_IMAGE_UPLOAD_BUCKET, objectPath);
  }

  async createSignedVideoUpload(objectPath: string): Promise<string> {
    return this.createSignedUploadFor(STORY_VIDEO_UPLOAD_BUCKET, objectPath);
  }

  private async createSignedUploadFor(
    bucket: string,
    objectPath: string,
  ): Promise<string> {
    const { data, error } = await this.storage
      .from(bucket)
      .createSignedUploadUrl(objectPath, { upsert: false });
    if (error || !data.token) {
      throw new Error(
        `Storage upload authorization failed: ${error?.message ?? 'no token'}`,
      );
    }
    return data.token;
  }

  async downloadVideoUpload(objectPath: string): Promise<Blob> {
    return this.downloadFrom(STORY_VIDEO_UPLOAD_BUCKET, objectPath);
  }

  async inspectVideoUpload(
    objectPath: string,
  ): Promise<{ size: number; prefix: Uint8Array }> {
    const head = await this.videoObjectRequest(
      STORY_VIDEO_UPLOAD_BUCKET,
      objectPath,
      'HEAD',
    );
    if (!head.ok) throw new Error(`Video upload not found (${head.status})`);
    const size = Number(head.headers.get('content-length'));
    if (!Number.isFinite(size) || size < 1)
      throw new Error('Video upload size unavailable');
    const preview = await this.videoObjectRequest(
      STORY_VIDEO_UPLOAD_BUCKET,
      objectPath,
      'GET',
      { Range: 'bytes=0-31' },
    );
    if (!preview.ok || !preview.body)
      throw new Error('Video upload could not be inspected');
    const reader: ReadableStreamDefaultReader<Uint8Array> = preview.body.getReader();
    const bytes = new Uint8Array(32);
    let length = 0;
    while (length < bytes.length) {
      const next = await reader.read();
      if (next.done) break;
      const part = next.value.slice(0, bytes.length - length);
      bytes.set(part, length);
      length += part.length;
    }
    await reader.cancel();
    return { size, prefix: bytes.slice(0, length) };
  }

  async publishVerifiedVideoStream(
    objectPath: string,
    contentType: StoryVideoContentType,
    size: number,
  ): Promise<void> {
    const source = await this.videoObjectRequest(
      STORY_VIDEO_UPLOAD_BUCKET,
      objectPath,
      'GET',
    );
    if (!source.ok || !source.body) throw new Error('Verified video could not be read');
    const target = await this.videoObjectRequest(
      STORY_VIDEO_BUCKET,
      objectPath,
      'POST',
      {
        'Content-Type': contentType,
        'Content-Length': String(size),
        'cache-control': '31536000',
        'x-upsert': 'true',
      },
      source.body,
    );
    if (!target.ok)
      throw new Error(
        `Video publication failed (${target.status}): ${await target.text()}`,
      );
  }

  private videoObjectRequest(
    bucket: string,
    objectPath: string,
    method: string,
    extraHeaders: Record<string, string> = {},
    body?: ReadableStream<Uint8Array>,
  ): Promise<Response> {
    if (!this.storageUrl || !this.serviceKey)
      throw new Error('Media storage is not configured');
    const path = objectPath.split('/').map(encodeURIComponent).join('/');
    const url = `${this.storageUrl.replace(/\/$/u, '')}/storage/v1/object/${bucket === STORY_VIDEO_UPLOAD_BUCKET ? 'authenticated/' : ''}${bucket}/${path}`;
    return fetch(url, {
      method,
      headers: {
        apikey: this.serviceKey,
        authorization: `Bearer ${this.serviceKey}`,
        ...extraHeaders,
      },
      ...(body ? { body, duplex: 'half' } : {}),
    });
  }

  async downloadUpload(objectPath: string): Promise<Blob> {
    return this.downloadFrom(RECOMMENDATION_IMAGE_UPLOAD_BUCKET, objectPath);
  }

  private async downloadFrom(bucket: string, objectPath: string): Promise<Blob> {
    const { data, error } = await this.storage
      .from(bucket)
      .download(objectPath, {}, { cache: 'no-store' });
    if (error || !data) {
      throw new Error(`Storage object download failed: ${error?.message ?? 'not found'}`);
    }
    return data;
  }

  videoPublicUrl(objectPath: string): string {
    return this.storage.from(STORY_VIDEO_BUCKET).getPublicUrl(objectPath).data.publicUrl;
  }

  publicUrl(objectPath: string): string {
    return this.storage.from(RECOMMENDATION_IMAGE_BUCKET).getPublicUrl(objectPath).data
      .publicUrl;
  }

  async publishVerified(
    objectPath: string,
    contentType: RecommendationImageContentType,
    data: Blob,
  ): Promise<void> {
    const { error } = await this.storage
      .from(RECOMMENDATION_IMAGE_BUCKET)
      .upload(objectPath, data, {
        cacheControl: '31536000',
        contentType,
        upsert: true,
      });
    if (error) throw new Error(`Storage publication failed: ${error.message}`);
  }

  async publishVerifiedVideo(
    objectPath: string,
    contentType: StoryVideoContentType,
    data: Blob,
  ): Promise<void> {
    const { error } = await this.storage
      .from(STORY_VIDEO_BUCKET)
      .upload(objectPath, data, {
        cacheControl: '31536000',
        contentType,
        upsert: true,
      });
    if (error) throw new Error(`Storage publication failed: ${error.message}`);
  }

  async removeUpload(objectPath: string): Promise<void> {
    await this.removeFrom(RECOMMENDATION_IMAGE_UPLOAD_BUCKET, objectPath);
  }

  async removeVideoUpload(objectPath: string): Promise<void> {
    await this.removeFrom(STORY_VIDEO_UPLOAD_BUCKET, objectPath);
  }

  async removePublished(objectPath: string): Promise<void> {
    await this.removeFrom(RECOMMENDATION_IMAGE_BUCKET, objectPath);
  }

  async removePublishedVideo(objectPath: string): Promise<void> {
    await this.removeFrom(STORY_VIDEO_BUCKET, objectPath);
  }

  async removeAccountAssets(assets: AccountMediaAsset[]): Promise<void> {
    const removals = new Map<string, string[]>();
    for (const asset of assets) {
      const buckets =
        asset.mediaKind === 'story_video'
          ? [STORY_VIDEO_UPLOAD_BUCKET, STORY_VIDEO_BUCKET]
          : [RECOMMENDATION_IMAGE_UPLOAD_BUCKET, RECOMMENDATION_IMAGE_BUCKET];
      for (const bucket of buckets) {
        const paths = removals.get(bucket) ?? [];
        paths.push(asset.objectPath);
        removals.set(bucket, paths);
      }
    }

    await Promise.all(
      [...removals].map(async ([bucket, objectPaths]) => {
        const { error } = await this.storage.from(bucket).remove(objectPaths);
        if (error) throw new Error(`Storage object deletion failed: ${error.message}`);
      }),
    );
  }

  private async removeFrom(bucket: string, objectPath: string): Promise<void> {
    const { error } = await this.storage.from(bucket).remove([objectPath]);
    if (error) throw new Error(`Storage object deletion failed: ${error.message}`);
  }

  private get storage(): SupabaseClient['storage'] {
    if (!this.client) throw new Error('Media storage is not configured');
    return this.client.storage;
  }
}
