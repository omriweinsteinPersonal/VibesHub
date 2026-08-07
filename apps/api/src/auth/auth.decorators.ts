import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Capability } from '@vibeshub/auth';

import type { AuthenticatedRequest, RequestActor } from './auth.types.js';

export const IS_PUBLIC_KEY = 'vibeshub:is-public';
export const REQUIRED_CAPABILITIES_KEY = 'vibeshub:required-capabilities';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequireCapabilities = (...required: Capability[]) =>
  SetMetadata(REQUIRED_CAPABILITIES_KEY, required);

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestActor => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.actor)
      throw new Error('Authenticated actor is missing from request context');
    return request.actor;
  },
);
