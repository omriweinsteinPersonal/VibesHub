import { Injectable } from '@nestjs/common';
import type {
  CreatorProfilePatch,
  CreatorProfileSettings,
  CreatorProfileSocialLink,
} from '@vibeshub/contracts';

import { Database } from '../database.js';

interface CreatorProfileRow {
  avatarAssetId: string | null;
  avatarUrl: string | null;
  bioHe: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  displayName: string;
  handle: string;
  id: string;
  socialLinks: CreatorProfileSocialLink[];
  version: number;
}

export type CreatorProfileUpdateResult =
  | { kind: 'not_found' }
  | { actualVersion: number; kind: 'version_conflict' }
  | { kind: 'invalid_category' }
  | { kind: 'invalid_avatar' }
  | { kind: 'invalid_handle' }
  | { kind: 'updated'; profile: CreatorProfileSettings };

@Injectable()
export class CreatorProfileRepository {
  constructor(private readonly database: Database) {}

  async findOwned(userId: string): Promise<CreatorProfileSettings | null> {
    const [row] = await this.database.sql<CreatorProfileRow[]>`
      select
        creator.id,
        creator.handle::text as handle,
        creator.display_name as "displayName",
        creator.bio_he as "bioHe",
        creator.avatar_media_asset_id as "avatarAssetId",
        avatar.public_url as "avatarUrl",
        category.id as "categoryId",
        category.slug::text as "categorySlug",
        category.name_en as "categoryName",
        creator.version,
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'platform', link.platform,
                'url', link.url,
                'handle', link.handle
              ) order by link.sort_order, link.id
            )
            from app.creator_social_links link
            where link.creator_id = creator.id
          ),
          '[]'::jsonb
        ) as "socialLinks"
      from app.creator_profiles creator
      join app.categories category on category.id = creator.primary_category_id
      left join app.media_assets avatar
        on avatar.id = creator.avatar_media_asset_id
       and avatar.status = 'ready'
      where creator.user_id = ${userId}
        and creator.status = 'approved'
    `;
    return row ? mapProfile(row) : null;
  }

  async updateOwned(
    userId: string,
    expectedVersion: number,
    patch: CreatorProfilePatch,
  ): Promise<CreatorProfileUpdateResult> {
    return this.database.sql.begin(async (transaction) => {
      const [current] = await transaction<
        {
          avatarAssetId: string | null;
          bioHe: string;
          displayName: string;
          handle: string;
          id: string;
          primaryCategoryId: string;
          version: number;
        }[]
      >`
        select
          id,
          display_name as "displayName",
          handle::text as handle,
          bio_he as "bioHe",
          primary_category_id as "primaryCategoryId",
          avatar_media_asset_id as "avatarAssetId",
          version
        from app.creator_profiles
        where user_id = ${userId}
          and status = 'approved'
        for update
      `;
      if (!current) return { kind: 'not_found' };
      if (current.version !== expectedVersion) {
        return { actualVersion: current.version, kind: 'version_conflict' };
      }

      if (patch.primaryCategoryId) {
        const [category] = await transaction<{ id: string }[]>`
          select id from app.categories
          where id = ${patch.primaryCategoryId} and is_active = true
        `;
        if (!category) return { kind: 'invalid_category' };
      }

      if (patch.avatarAssetId) {
        const [avatar] = await transaction<{ id: string }[]>`
          select id from app.media_assets
          where id = ${patch.avatarAssetId}
            and owner_user_id = ${userId}
            and status = 'ready'
        `;
        if (!avatar) return { kind: 'invalid_avatar' };
      }

      if (patch.handle && patch.handle !== current.handle) {
        const [unavailable] = await transaction<{ unavailable: boolean }[]>`
          select (
            exists (
              select 1 from app.reserved_handles
              where handle = ${patch.handle}
            )
            or exists (
              select 1 from app.creator_profiles
              where handle = ${patch.handle}
                and id <> ${current.id}
            )
          ) as unavailable
        `;
        if (unavailable?.unavailable) return { kind: 'invalid_handle' };
      }

      const [updated] = await transaction<{ id: string }[]>`
        update app.creator_profiles
        set
          display_name = coalesce(${patch.displayName ?? null}, display_name),
          handle = coalesce(${patch.handle ?? null}, handle),
          bio_he = coalesce(${patch.bioHe ?? null}, bio_he),
          primary_category_id = coalesce(
            ${patch.primaryCategoryId ?? null}::uuid,
            primary_category_id
          ),
          avatar_media_asset_id = case
            when ${patch.avatarAssetId !== undefined}
              then ${patch.avatarAssetId ?? null}::uuid
            else avatar_media_asset_id
          end,
          version = version + 1
        where id = ${current.id}
          and version = ${expectedVersion}
        returning id
      `;
      if (!updated)
        return { actualVersion: current.version + 1, kind: 'version_conflict' };

      if (patch.primaryCategoryId) {
        await transaction`
          insert into app.creator_categories (creator_id, category_id, sort_order)
          values (${current.id}, ${patch.primaryCategoryId}, 0)
          on conflict (creator_id, category_id) do update set sort_order = 0
        `;
      }

      if (patch.socialLinks) {
        await transaction`
          delete from app.creator_social_links where creator_id = ${current.id}
        `;
        for (const [position, link] of patch.socialLinks.entries()) {
          await transaction`
            insert into app.creator_social_links (
              creator_id, platform, url, handle, sort_order
            ) values (
              ${current.id}, ${link.platform}, ${link.url}, ${link.handle ?? null}, ${position}
            )
          `;
        }
      }

      const changedFields = Object.keys(patch).toSorted();
      await transaction`
        insert into audit.entries (
          actor_user_id, action, target_type, target_id, metadata
        ) values (
          ${userId}, 'creator_profile.updated', 'creator_profile', ${current.id},
          ${JSON.stringify({ changedFields, fromVersion: current.version, toVersion: current.version + 1 })}::jsonb
        )
      `;

      const [profile] = await transaction<CreatorProfileRow[]>`
        select
          creator.id,
          creator.handle::text as handle,
          creator.display_name as "displayName",
          creator.bio_he as "bioHe",
          creator.avatar_media_asset_id as "avatarAssetId",
          avatar.public_url as "avatarUrl",
          category.id as "categoryId",
          category.slug::text as "categorySlug",
          category.name_en as "categoryName",
          creator.version,
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'platform', link.platform,
                  'url', link.url,
                  'handle', link.handle
                ) order by link.sort_order, link.id
              )
              from app.creator_social_links link
              where link.creator_id = creator.id
            ),
            '[]'::jsonb
          ) as "socialLinks"
        from app.creator_profiles creator
        join app.categories category on category.id = creator.primary_category_id
        left join app.media_assets avatar
          on avatar.id = creator.avatar_media_asset_id
         and avatar.status = 'ready'
        where creator.id = ${current.id}
      `;
      if (!profile) throw new Error('Updated creator profile could not be read');
      return { kind: 'updated', profile: mapProfile(profile) };
    });
  }
}

function mapProfile(row: CreatorProfileRow): CreatorProfileSettings {
  return {
    avatar:
      row.avatarAssetId && row.avatarUrl
        ? { assetId: row.avatarAssetId, url: row.avatarUrl }
        : null,
    bioHe: row.bioHe,
    displayName: row.displayName,
    handle: row.handle,
    id: row.id,
    primaryCategory: {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
    },
    socialLinks: row.socialLinks,
    version: row.version,
  };
}
