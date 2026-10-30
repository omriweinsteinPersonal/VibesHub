import { describe, expect, it, vi } from 'vitest';

import { AuthenticationGuard } from './auth.guard.js';
import type { AuthenticatedRequest, RequestActor } from './auth.types.js';
import { CapabilityGuard } from './capability.guard.js';

function contextFor(request: AuthenticatedRequest) {
  return {
    getClass: () => Object,
    getHandler: () => contextFor,
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

function setupAuthentication(request: AuthenticatedRequest) {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
  const verifier = { verify: vi.fn().mockResolvedValue({ userId: 'user-1' }) };
  const actor: RequestActor = {
    accountStatus: 'active',
    capabilities: new Set(['creator:manage_content']),
    userId: 'user-1',
  };
  const actors = { resolve: vi.fn().mockResolvedValue(actor) };
  const guard = new AuthenticationGuard(
    reflector as never,
    verifier as never,
    actors as never,
  );
  return { actor, actors, context: contextFor(request), guard, reflector, verifier };
}

function request(authorization?: string): AuthenticatedRequest {
  return { headers: authorization ? { authorization } : {}, id: 'req', url: '/' };
}

describe('authentication guard', () => {
  it('rejects requests without a bearer token before verification', async () => {
    const { context, guard, verifier } = setupAuthentication(
      request('Basic credentials'),
    );
    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      status: 401,
    });
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('rejects an invalid token without resolving an actor', async () => {
    const { actors, context, guard, verifier } = setupAuthentication(
      request('Bearer bad'),
    );
    verifier.verify.mockResolvedValue(null);
    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      status: 401,
    });
    expect(actors.resolve).not.toHaveBeenCalled();
  });

  it('rejects a valid token for a deleted or missing platform account', async () => {
    const { actors, context, guard } = setupAuthentication(request('Bearer old-token'));
    actors.resolve.mockResolvedValue(null);
    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('rejects restricted accounts', async () => {
    const { actor, actors, context, guard } = setupAuthentication(
      request('Bearer valid'),
    );
    actors.resolve.mockResolvedValue({ ...actor, accountStatus: 'suspended' });
    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('rejects a platform account marked as deleted even if the token is valid', async () => {
    const { actor, actors, context, guard } = setupAuthentication(
      request('Bearer valid'),
    );
    actors.resolve.mockResolvedValue({ ...actor, accountStatus: 'deleted' });
    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('attaches the database-resolved actor for a valid active account', async () => {
    const req = request('Bearer valid');
    const { actor, actors, context, guard, verifier } = setupAuthentication(req);
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith('valid');
    expect(actors.resolve).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(req.actor).toBe(actor);
  });

  it('allows a public route without processing credentials', async () => {
    const { context, guard, reflector, verifier } = setupAuthentication(request());
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(verifier.verify).not.toHaveBeenCalled();
  });
});

describe('capability guard', () => {
  it('denies missing or insufficient capabilities and allows the required capability', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['creator:manage_content']),
    };
    const guard = new CapabilityGuard(reflector as never);
    const req = request();
    expect(() => guard.canActivate(contextFor(req) as never)).toThrow();
    req.actor = {
      userId: 'user-1',
      accountStatus: 'active',
      capabilities: new Set(['creator:view_analytics']),
    };
    expect(() => guard.canActivate(contextFor(req) as never)).toThrow();
    req.actor.capabilities = new Set(['creator:manage_content']);
    expect(guard.canActivate(contextFor(req) as never)).toBe(true);
    req.actor.capabilities = new Set(['admin:manage_platform']);
    expect(guard.canActivate(contextFor(req) as never)).toBe(true);
  });
});
