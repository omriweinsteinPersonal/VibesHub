import {
  categoryCardSchema,
  creatorApplicationStatusSchema,
  creatorHandleAvailabilitySchema,
  type CategoryCard,
  type CreatorApplicationInput,
  type CreatorApplicationStatus,
} from '@vibeshub/contracts';
import * as Crypto from 'expo-crypto';

import { creatorRequest } from './creator-api';
import {
  destinationForAccount,
  type AccountSummary,
  type SignedInDestination,
} from './creator-onboarding-routing';

export {
  isCreatorHandle,
  normalizeCreatorHandle,
  suggestCreatorHandle,
} from './creator-onboarding-routing';

export interface CreatorApplication {
  bioText: string | null;
  displayName: string | null;
  feedback: {
    createdAt: string;
    decision: string;
    publicMessage: string;
  }[];
  id: string;
  primaryCategoryId: string | null;
  requestedHandle: string | null;
  socialLinks: {
    followerCount?: number | null;
    platform: string;
    url: string;
  }[];
  status: CreatorApplicationStatus;
}

export async function getAccountSummary(): Promise<AccountSummary> {
  return creatorRequest('/v1/me', parseAccountSummary);
}

export async function getSignedInDestination(): Promise<SignedInDestination> {
  return destinationForAccount(await getAccountSummary());
}

export async function getCreatorApplication(): Promise<CreatorApplication | null> {
  return creatorRequest('/v1/creator-applications/current', (value) =>
    value === null ? null : parseCreatorApplication(value),
  );
}

export async function getCreatorCategories(): Promise<CategoryCard[]> {
  return creatorRequest('/v1/categories', (value) =>
    categoryCardSchema.array().parse(value),
  );
}

export async function checkCreatorHandle(handle: string): Promise<boolean> {
  return creatorRequest(
    `/v1/creator-applications/handle-availability?handle=${encodeURIComponent(handle)}`,
    (value) => creatorHandleAvailabilitySchema.parse(value).available,
  );
}

export async function saveAndSubmitCreatorApplication(
  input: CreatorApplicationInput,
  current: CreatorApplication | null,
): Promise<CreatorApplication> {
  const draft = current
    ? await creatorRequest(
        `/v1/creator-applications/${encodeURIComponent(current.id)}`,
        parseCreatorApplication,
        { body: JSON.stringify(input), method: 'PATCH' },
      )
    : await creatorRequest('/v1/creator-applications', parseCreatorApplication, {
        body: JSON.stringify(input),
        headers: { 'idempotency-key': Crypto.randomUUID() },
        method: 'POST',
      });

  return creatorRequest(
    `/v1/creator-applications/${encodeURIComponent(draft.id)}/submit`,
    parseCreatorApplication,
    {
      headers: { 'idempotency-key': Crypto.randomUUID() },
      method: 'POST',
    },
  );
}

function parseAccountSummary(value: unknown): AccountSummary {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error('Invalid account response');
  }
  const application = isRecord(value.application)
    ? {
        id: requireString(value.application.id),
        status: creatorApplicationStatusSchema.parse(value.application.status),
      }
    : null;
  const creator = isRecord(value.creator)
    ? {
        handle: requireString(value.creator.handle),
        id: requireString(value.creator.id),
      }
    : null;
  return {
    application,
    capabilities: Array.isArray(value.capabilities)
      ? value.capabilities.filter((item): item is string => typeof item === 'string')
      : [],
    creator,
    ...(typeof value.email === 'string' ? { email: value.email } : {}),
    id: value.id,
  };
}

function parseCreatorApplication(value: unknown): CreatorApplication {
  if (!isRecord(value)) throw new Error('Invalid creator application response');
  return {
    bioText: nullableString(value.bioText),
    displayName: nullableString(value.displayName),
    feedback: Array.isArray(value.feedback)
      ? value.feedback.flatMap((item) =>
          isRecord(item) &&
          typeof item.createdAt === 'string' &&
          typeof item.decision === 'string' &&
          typeof item.publicMessage === 'string'
            ? [
                {
                  createdAt: item.createdAt,
                  decision: item.decision,
                  publicMessage: item.publicMessage,
                },
              ]
            : [],
        )
      : [],
    id: requireString(value.id),
    primaryCategoryId: nullableString(value.primaryCategoryId),
    requestedHandle: nullableString(value.requestedHandle),
    socialLinks: Array.isArray(value.socialLinks)
      ? value.socialLinks.flatMap((item) =>
          isRecord(item) &&
          typeof item.platform === 'string' &&
          typeof item.url === 'string'
            ? [
                {
                  ...(typeof item.followerCount === 'number'
                    ? { followerCount: item.followerCount }
                    : {}),
                  platform: item.platform,
                  url: item.url,
                },
              ]
            : [],
        )
      : [],
    status: creatorApplicationStatusSchema.parse(value.status),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function requireString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected a string');
  return value;
}
