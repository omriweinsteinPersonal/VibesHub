import { Injectable } from '@nestjs/common';
import type {
  RecommendationImageContentType,
  StoryVideoContentType,
} from '@vibeshub/contracts';

import { Database } from '../database.js';

export interface MediaAssetRow {
  contentType: RecommendationImageContentType | StoryVideoContentType;
  declaredSizeBytes: string;
  id: string;
  mediaKind: 'recommendation_image' | 'story_video';
  objectPath: string;
  publicUrl: string | null;
  sizeBytes: string | null;
  status: 'pending_upload' | 'ready' | 'failed' | 'deleted';
  version: number;
}

@Injectable()
export class MediaRepository {
  constructor(private readonly database: Database) {}

  async createPending(input: {
    bucketId: 'recommendation-images' | 'story-videos';
    contentType: RecommendationImageContentType | StoryVideoContentType;
    declaredSizeBytes: number;
    expiresAt: string;
    id: string;
    objectPath: string;
    mediaKind: 'recommendation_image' | 'story_video';
    userId: string;
  }): Promise<MediaAssetRow> {
    const [asset] = await this.database.sql<MediaAssetRow[]>`
      insert into app.media_assets (
        id,
        owner_user_id,
        media_kind,
        bucket_id,
        object_path,
        content_type,
        declared_size_bytes,
        upload_expires_at
      ) values (
        ${input.id},
        ${input.userId},
        ${input.mediaKind},
        ${input.bucketId},
        ${input.objectPath},
        ${input.contentType},
        ${input.declaredSizeBytes},
        ${input.expiresAt}
      )
      returning
        id,
        media_kind as "mediaKind",
        object_path as "objectPath",
        content_type as "contentType",
        declared_size_bytes::text as "declaredSizeBytes",
        size_bytes::text as "sizeBytes",
        status,
        public_url as "publicUrl",
        version
    `;
    if (!asset) throw new Error('Media asset insert did not return a record');
    return asset;
  }

  async findOwned(id: string, userId: string): Promise<MediaAssetRow | null> {
    const [asset] = await this.database.sql<MediaAssetRow[]>`
      select
        id,
        media_kind as "mediaKind",
        object_path as "objectPath",
        content_type as "contentType",
        declared_size_bytes::text as "declaredSizeBytes",
        size_bytes::text as "sizeBytes",
        status,
        public_url as "publicUrl",
        version
      from app.media_assets
      where id = ${id}
        and owner_user_id = ${userId}
    `;
    return asset ?? null;
  }

  async markReady(
    id: string,
    userId: string,
    expectedVersion: number,
    sizeBytes: number,
    publicUrl: string,
  ): Promise<MediaAssetRow | null> {
    const [asset] = await this.database.sql<MediaAssetRow[]>`
      update app.media_assets
      set
        status = 'ready',
        size_bytes = ${sizeBytes},
        public_url = ${publicUrl},
        completed_at = statement_timestamp(),
        version = version + 1
      where id = ${id}
        and owner_user_id = ${userId}
        and status = 'pending_upload'
        and version = ${expectedVersion}
      returning
        id,
        media_kind as "mediaKind",
        object_path as "objectPath",
        content_type as "contentType",
        declared_size_bytes::text as "declaredSizeBytes",
        size_bytes::text as "sizeBytes",
        status,
        public_url as "publicUrl",
        version
    `;
    return asset ?? null;
  }

  async markFailed(
    id: string,
    userId: string,
    failureCode: 'missing_object' | 'invalid_content' | 'size_mismatch',
  ): Promise<void> {
    await this.database.sql`
      update app.media_assets
      set
        status = 'failed',
        failure_code = ${failureCode},
        deleted_at = statement_timestamp(),
        public_url = null,
        version = version + 1
      where id = ${id}
        and owner_user_id = ${userId}
        and status = 'pending_upload'
    `;
  }

  async countReferences(id: string): Promise<number> {
    const [row] = await this.database.sql<{ count: number }[]>`
      select (
        (select count(*) from app.recommendations where image_asset_id = ${id})
        + (select count(*) from app.products where primary_image_asset_id = ${id})
        + (select count(*) from app.creator_profiles where avatar_media_asset_id = ${id})
        + (select count(*) from app.recommendation_story_clips where media_asset_id = ${id})
      )::integer as count
    `;
    return row?.count ?? 0;
  }

  async markDeleted(id: string, userId: string): Promise<void> {
    await this.database.sql`
      update app.media_assets
      set
        status = 'deleted',
        deleted_at = coalesce(deleted_at, statement_timestamp()),
        public_url = null,
        version = version + 1
      where id = ${id}
        and owner_user_id = ${userId}
        and status <> 'deleted'
    `;
  }
}
