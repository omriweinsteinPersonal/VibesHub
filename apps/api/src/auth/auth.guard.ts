import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { problem } from '../api-problem.js';
import { ActorRepository } from './actor.repository.js';
import { IS_PUBLIC_KEY } from './auth.decorators.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { SupabaseTokenVerifier } from './token-verifier.js';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenVerifier: SupabaseTokenVerifier,
    private readonly actors: ActorRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    const match = header?.match(/^Bearer\s+(.+)$/i);
    if (!match?.[1]) {
      throw problem(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
    }

    const identity = await this.tokenVerifier.verify(match[1]);
    if (!identity) {
      throw problem(
        401,
        'AUTHENTICATION_REQUIRED',
        'The access token is invalid or expired',
      );
    }

    const actor = await this.actors.resolve(identity);
    if (!actor) {
      throw problem(
        401,
        'AUTHENTICATION_REQUIRED',
        'The platform account does not exist',
      );
    }
    if (actor.accountStatus !== 'active') {
      throw problem(403, 'ACCOUNT_RESTRICTED', 'This account is currently restricted');
    }

    request.actor = actor;
    return true;
  }
}
