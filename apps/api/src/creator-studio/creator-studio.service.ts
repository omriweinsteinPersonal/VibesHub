import { Injectable } from '@nestjs/common';
import type {
  CreatorMediaKitInput,
  CreatorStorefrontConfigurationInput,
  StorefrontTheme,
} from '@vibeshub/contracts';

import { problem } from '../api-problem.js';
import { CreatorStudioRepository } from './creator-studio.repository.js';

@Injectable()
export class CreatorStudioService {
  constructor(private readonly studio: CreatorStudioRepository) {}

  async summary(userId: string) {
    return this.requireCreator(await this.studio.getSummary(userId));
  }

  async storefrontConfiguration(userId: string) {
    return this.requireCreator(await this.studio.getStorefrontConfiguration(userId));
  }

  async storefrontTheme(userId: string) {
    return this.requireCreator(await this.studio.getStorefrontTheme(userId));
  }

  async replaceStorefrontTheme(
    userId: string,
    expectedVersion: number,
    theme: StorefrontTheme,
  ) {
    const result = await this.studio.replaceStorefrontTheme(
      userId,
      expectedVersion,
      theme,
    );
    if (result.kind === 'updated') return result.data;
    if (result.kind === 'version_conflict') {
      throw problem(
        412,
        'PRECONDITION_FAILED',
        'The storefront design changed before this update was saved',
      );
    }
    return this.requireCreator(null);
  }

  async replaceStorefrontConfiguration(
    userId: string,
    expectedVersion: number,
    input: CreatorStorefrontConfigurationInput,
  ) {
    const result = await this.studio.replaceStorefrontConfiguration(
      userId,
      expectedVersion,
      input,
    );
    if (result.kind === 'updated') return result.data;
    if (result.kind === 'invalid_categories') {
      throw problem(422, 'VALIDATION_FAILED', 'Choose active storefront categories');
    }
    if (result.kind === 'invalid_recommendations') {
      throw problem(422, 'VALIDATION_FAILED', 'Choose your active recommendations');
    }
    if (result.kind === 'version_conflict') {
      throw problem(
        412,
        'PRECONDITION_FAILED',
        'The storefront sections changed before this update was saved',
      );
    }
    return this.requireCreator(null);
  }

  async mediaKit(userId: string) {
    return this.requireCreator(await this.studio.getMediaKit(userId));
  }

  async replaceMediaKit(
    userId: string,
    expectedVersion: number,
    input: CreatorMediaKitInput,
  ) {
    const result = await this.studio.replaceMediaKit(userId, expectedVersion, input);
    if (result.kind === 'updated') return result.data;
    if (result.kind === 'version_conflict') {
      throw problem(
        412,
        'PRECONDITION_FAILED',
        'The media kit changed before this update was saved',
      );
    }
    return this.requireCreator(null);
  }

  private requireCreator<T>(value: T | null): T {
    if (value) return value;
    throw problem(403, 'CAPABILITY_REQUIRED', 'An approved creator profile is required');
  }
}
