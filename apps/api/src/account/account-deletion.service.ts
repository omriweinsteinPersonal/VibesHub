import { Injectable } from '@nestjs/common';
import { logger } from '@vibeshub/observability';

import { problem } from '../api-problem.js';
import { MediaRepository } from '../media/media.repository.js';
import { MediaStorageGateway } from '../media/media-storage.gateway.js';
import { AccountAuthGateway } from './account-auth.gateway.js';
import { AppleAuthorizationGateway } from './apple-authorization.gateway.js';

interface AccountDeletionOptions {
  appleAuthorizationCode?: string;
  providers: readonly string[];
}

@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly auth: AccountAuthGateway,
    private readonly appleAuthorization: AppleAuthorizationGateway,
    private readonly media: MediaRepository,
    private readonly storage: MediaStorageGateway,
  ) {}

  async deleteAccount(userId: string, options: AccountDeletionOptions): Promise<void> {
    const ownedAssetIds = await this.media.listOwnedIds(userId);

    if (options.providers.includes('apple')) {
      if (!options.appleAuthorizationCode) {
        throw problem(
          400,
          'APPLE_REAUTHENTICATION_REQUIRED',
          'A fresh Apple authorization is required to delete this account',
        );
      }
      await this.appleAuthorization.revokeAuthorizationCode(
        options.appleAuthorizationCode,
      );
    }

    // Deleting the Auth user cascades through app.users and all creator-owned data.
    // It also removes refresh sessions, so the account cannot mint new access tokens.
    await this.auth.deleteUser(userId);

    if (ownedAssetIds.length === 0) return;

    // Shared catalog media is intentionally retained without an account owner. Media
    // that is no longer referenced is removed from both Postgres and Storage.
    try {
      const orphanedAssets = await this.media.deleteUnreferenced(ownedAssetIds);
      await this.storage.removeAccountAssets(orphanedAssets);
    } catch (error) {
      // The identity and creator data are already gone. Do not turn a completed
      // account deletion into an error screen because best-effort blob cleanup failed.
      logger.warn('Orphaned account media cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
    }
  }
}
