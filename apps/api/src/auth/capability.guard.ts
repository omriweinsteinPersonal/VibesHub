import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasCapability, type Capability } from '@vibeshub/auth';

import { problem } from '../api-problem.js';
import { REQUIRED_CAPABILITIES_KEY } from './auth.decorators.js';
import type { AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Capability[]>(
      REQUIRED_CAPABILITIES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const actor = context.switchToHttp().getRequest<AuthenticatedRequest>().actor;
    if (
      !actor ||
      required.some((capability) => !hasCapability(actor.capabilities, capability))
    ) {
      throw problem(403, 'CAPABILITY_REQUIRED', 'This action requires additional access');
    }
    return true;
  }
}
