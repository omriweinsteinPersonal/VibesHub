import { Injectable } from '@nestjs/common';
import type { CreatorProfilePatch, CreatorProfileSettings } from '@vibeshub/contracts';

import { problem } from '../api-problem.js';
import { CreatorProfileRepository } from './creator-profile.repository.js';

@Injectable()
export class CreatorProfileService {
  constructor(private readonly profiles: CreatorProfileRepository) {}

  async get(userId: string): Promise<CreatorProfileSettings> {
    const profile = await this.profiles.findOwned(userId);
    if (!profile) {
      throw problem(
        403,
        'CAPABILITY_REQUIRED',
        'An approved creator profile is required',
      );
    }
    return profile;
  }

  async update(
    userId: string,
    expectedVersion: number,
    patch: CreatorProfilePatch,
  ): Promise<CreatorProfileSettings> {
    const result = await this.profiles.updateOwned(userId, expectedVersion, patch);
    if (result.kind === 'updated') return result.profile;
    if (result.kind === 'not_found') {
      throw problem(
        403,
        'CAPABILITY_REQUIRED',
        'An approved creator profile is required',
      );
    }
    if (result.kind === 'invalid_category') {
      throw problem(422, 'VALIDATION_FAILED', 'Choose an active creator category');
    }
    if (result.kind === 'invalid_avatar') {
      throw problem(422, 'VALIDATION_FAILED', 'Choose an image uploaded by this account');
    }
    if (result.kind === 'invalid_handle') {
      throw problem(409, 'RESOURCE_CONFLICT', 'That storefront handle is unavailable');
    }
    throw problem(
      412,
      'PRECONDITION_FAILED',
      'The creator profile changed before this update was saved',
    );
  }
}
