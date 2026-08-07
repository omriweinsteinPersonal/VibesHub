import type { Capability } from '@vibeshub/auth';

export interface VerifiedIdentity {
  email?: string;
  userId: string;
}

export interface RequestActor extends VerifiedIdentity {
  accountStatus: 'active' | 'deleted' | 'suspended';
  capabilities: ReadonlySet<Capability>;
}

export interface AuthenticatedRequest {
  actor?: RequestActor;
  headers: Record<string, string | string[] | undefined>;
  id: string;
  url: string;
}
