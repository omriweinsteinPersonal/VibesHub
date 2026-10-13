import {
  creatorAnalyticsDashboardSchema,
  creatorBrandSchema,
  creatorProfileSettingsSchema,
  creatorRecommendationSchema,
  creatorStorefrontConfigurationSchema,
  creatorStudioSummarySchema,
} from '@vibeshub/contracts';
import type {
  CreatorAnalyticsDashboard,
  CreatorBrand,
  CreatorBrandInput,
  CreatorProfilePatch,
  CreatorProfileSettings,
  CreatorRecommendation,
  CreatorStorefrontConfiguration,
  CreatorStorefrontConfigurationInput,
  CreatorStudioSummary,
} from '@vibeshub/contracts';
import * as Crypto from 'expo-crypto';

import { ApiError } from './api';
import { getSupabaseClient } from './supabase';

interface Envelope<T> {
  data?: T;
  detail?: string;
  message?: string;
  title?: string;
}

export interface CreatorStudioBundle {
  analytics: CreatorAnalyticsDashboard;
  brands: CreatorBrand[];
  configuration: CreatorStorefrontConfiguration;
  profile: CreatorProfileSettings;
  recommendations: CreatorRecommendation[];
  summary: CreatorStudioSummary;
}

const studioCacheLifetimeMs = 60_000;
let studioCache: { bundle: CreatorStudioBundle; expiresAt: number } | null = null;
let studioRequest: Promise<CreatorStudioBundle> | null = null;

export function getCachedCreatorStudioBundle(): CreatorStudioBundle | null {
  return studioCache?.bundle ?? null;
}

export function cacheCreatorStudioBundle(bundle: CreatorStudioBundle): void {
  studioCache = { bundle, expiresAt: Date.now() + studioCacheLifetimeMs };
}

export function clearCreatorStudioBundleCache(): void {
  studioCache = null;
  studioRequest = null;
}

export async function getCreatorStudioBundle(
  days = 30,
  options: { forceRefresh?: boolean } = {},
): Promise<CreatorStudioBundle> {
  if (!options.forceRefresh && studioCache && studioCache.expiresAt > Date.now()) {
    return studioCache.bundle;
  }
  if (!options.forceRefresh && studioRequest) return studioRequest;

  const request = loadCreatorStudioBundle(days);
  studioRequest = request;
  try {
    const bundle = await request;
    cacheCreatorStudioBundle(bundle);
    return bundle;
  } finally {
    if (studioRequest === request) studioRequest = null;
  }
}

async function loadCreatorStudioBundle(days: number): Promise<CreatorStudioBundle> {
  const [summary, profile, brands, recommendations, configuration, analytics] =
    await Promise.all([
      creatorRequest('/v1/creator/studio', creatorStudioSummarySchema.parse),
      creatorRequest('/v1/creator/profile', creatorProfileSettingsSchema.parse),
      creatorRequest('/v1/creator/brands', (value) =>
        creatorBrandSchema.array().parse(value),
      ),
      creatorCollectionRequest('/v1/creator/recommendations?limit=48', (value) =>
        creatorRecommendationSchema.array().parse(value),
      ),
      creatorRequest(
        '/v1/creator/studio/storefront-sections',
        creatorStorefrontConfigurationSchema.parse,
      ),
      creatorRequest(
        `/v1/creator/analytics?days=${days}`,
        creatorAnalyticsDashboardSchema.parse,
      ),
    ]);

  return { analytics, brands, configuration, profile, recommendations, summary };
}

export function updateCreatorProfile(
  profile: CreatorProfileSettings,
  patch: CreatorProfilePatch,
): Promise<CreatorProfileSettings> {
  return creatorRequest('/v1/creator/profile', creatorProfileSettingsSchema.parse, {
    body: JSON.stringify(patch),
    headers: { 'if-match': `"${profile.version}"` },
    method: 'PATCH',
  });
}

export function saveCreatorBrand(
  input: CreatorBrandInput,
  brand?: CreatorBrand,
): Promise<CreatorBrand> {
  return creatorRequest(
    brand ? `/v1/creator/brands/${brand.id}` : '/v1/creator/brands',
    creatorBrandSchema.parse,
    {
      body: JSON.stringify(input),
      headers: brand ? { 'if-match': `"${brand.version}"` } : undefined,
      method: brand ? 'PATCH' : 'POST',
    },
  );
}

export function transitionCreatorRecommendation(
  recommendation: CreatorRecommendation,
  command: 'publish' | 'unpublish' | 'restore',
): Promise<CreatorRecommendation> {
  return creatorRequest(
    `/v1/creator/recommendations/${recommendation.id}/${command}`,
    creatorRecommendationSchema.parse,
    {
      headers: {
        'idempotency-key': Crypto.randomUUID(),
        'if-match': `"${recommendation.version}"`,
      },
      method: 'POST',
    },
  );
}

export function saveStorefrontConfiguration(
  configuration: CreatorStorefrontConfiguration,
  input: CreatorStorefrontConfigurationInput,
): Promise<CreatorStorefrontConfiguration> {
  return creatorRequest(
    '/v1/creator/studio/storefront-sections',
    creatorStorefrontConfigurationSchema.parse,
    {
      body: JSON.stringify(input),
      headers: { 'if-match': `"${configuration.version}"` },
      method: 'PUT',
    },
  );
}

export function newStudioId(): string {
  return Crypto.randomUUID();
}

async function creatorCollectionRequest<T>(
  path: string,
  parse: (value: unknown) => T,
): Promise<T> {
  return creatorRequest(path, (value) => parse(value));
}

export async function creatorRequest<T>(
  path: string,
  parse: (value: unknown) => T,
  init: RequestInit = {},
): Promise<T> {
  const {
    data: { session },
  } = await getSupabaseClient().auth.getSession();
  if (!session) throw new ApiError('Please log in to continue.', 401);

  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${session.access_token}`);
  if (init.body) headers.set('content-type', 'application/json');
  if (headers.has('if-match')) {
    headers.set('x-swavii-if-match', headers.get('if-match')!);
    headers.delete('if-match');
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Could not connect to Swavii. Please try again.', 503);
  }

  const text = await response.text();
  let body: Envelope<unknown> | null = null;
  if (text.trim()) {
    try {
      body = JSON.parse(text) as Envelope<unknown>;
    } catch {
      if (response.ok) throw new ApiError('Swavii returned an invalid response.', 502);
    }
  }
  if (!response.ok) {
    throw new ApiError(
      body?.detail ?? body?.message ?? body?.title ?? 'The request failed.',
      response.status,
    );
  }

  try {
    return parse(body?.data);
  } catch {
    throw new ApiError('Swavii returned an unexpected response. Please try again.', 502);
  }
}

function apiUrl(): string {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!value) throw new ApiError('The Swavii API is not configured.', 500);
  return value.replace(/\/$/, '');
}
