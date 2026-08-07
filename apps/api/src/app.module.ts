import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { AccountController } from './account/account.controller.js';
import { AccountRepository } from './account/account.repository.js';
import { ActorRepository } from './auth/actor.repository.js';
import { AuthenticationGuard } from './auth/auth.guard.js';
import { CapabilityGuard } from './auth/capability.guard.js';
import { SupabaseTokenVerifier } from './auth/token-verifier.js';
import { CategoriesController } from './categories.controller.js';
import { AdminApplicationController } from './creator-applications/admin-application.controller.js';
import { ApplicationController } from './creator-applications/application.controller.js';
import { ApplicationRepository } from './creator-applications/application.repository.js';
import { ApplicationService } from './creator-applications/application.service.js';
import { Database } from './database.js';
import { HealthController } from './health.controller.js';
import { IdempotencyService } from './idempotency.service.js';
import { CreatorMediaController } from './media/creator-media.controller.js';
import { MediaRepository } from './media/media.repository.js';
import { MediaService } from './media/media.service.js';
import { MediaStorageGateway } from './media/media-storage.gateway.js';
import { DeferredVideoPreviewProvider } from './media/video-provider.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';
import { CreatorDirectoryRepository } from './discovery/creator-directory.repository.js';
import { CreatorsController } from './discovery/creators.controller.js';
import { CreatorRecommendationsController } from './recommendations/creator-recommendations.controller.js';
import { RecommendationRepository } from './recommendations/recommendation.repository.js';
import { RecommendationService } from './recommendations/recommendation.service.js';

@Module({
  controllers: [
    HealthController,
    CategoriesController,
    CreatorsController,
    CreatorRecommendationsController,
    CreatorMediaController,
    AccountController,
    ApplicationController,
    AdminApplicationController,
  ],
  providers: [
    Database,
    SupabaseTokenVerifier,
    ActorRepository,
    AccountRepository,
    ApplicationRepository,
    ApplicationService,
    CreatorDirectoryRepository,
    RecommendationRepository,
    RecommendationService,
    MediaRepository,
    MediaStorageGateway,
    MediaService,
    DeferredVideoPreviewProvider,
    IdempotencyService,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
