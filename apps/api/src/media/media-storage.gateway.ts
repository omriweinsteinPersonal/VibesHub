import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RecommendationImageContentType } from '@vibeshub/contracts';

import { parseApiConfig } from '../config.js';
import {
  RECOMMENDATION_IMAGE_BUCKET,
  RECOMMENDATION_IMAGE_UPLOAD_BUCKET,
} from './image-media.js';

@Injectable()
export class MediaStorageGateway {
  private readonly client: SupabaseClient | null;

  constructor() {
    const config = parseApiConfig(process.env);
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
    const { data, error } = await this.storage
      .from(RECOMMENDATION_IMAGE_UPLOAD_BUCKET)
      .createSignedUploadUrl(objectPath, { upsert: false });
    if (error || !data.token) {
      throw new Error(
        `Storage upload authorization failed: ${error?.message ?? 'no token'}`,
      );
    }
    return data.token;
  }

  async downloadUpload(objectPath: string): Promise<Blob> {
    const { data, error } = await this.storage
      .from(RECOMMENDATION_IMAGE_UPLOAD_BUCKET)
      .download(objectPath, {}, { cache: 'no-store' });
    if (error || !data) {
      throw new Error(`Storage object download failed: ${error?.message ?? 'not found'}`);
    }
    return data;
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

  async removeUpload(objectPath: string): Promise<void> {
    await this.removeFrom(RECOMMENDATION_IMAGE_UPLOAD_BUCKET, objectPath);
  }

  async removePublished(objectPath: string): Promise<void> {
    await this.removeFrom(RECOMMENDATION_IMAGE_BUCKET, objectPath);
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
