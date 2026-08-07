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
import { ProblemDetailsFilter } from './problem-details.filter.js';

@Module({
  controllers: [
    HealthController,
    CategoriesController,
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
    IdempotencyService,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
