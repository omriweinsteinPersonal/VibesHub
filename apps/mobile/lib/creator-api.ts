import {
  categoryCardSchema,
  creatorAnalyticsDashboardSchema,
  creatorBrandSchema,
  creatorDiscountCodeSchema,
  creatorHandleAvailabilitySchema,
  creatorProfileSettingsSchema,
  creatorProductMetadataSchema,
  creatorRecommendationSchema,
  creatorStorefrontConfigurationSchema,
  creatorStudioSummarySchema,
  storefrontThemeConfigurationSchema,
} from '@vibeshub/contracts';
import type {
  CategoryCard,
  CreatorAnalyticsDashboard,
  CreatorBrand,
  CreatorBrandInput,
  CreatorDiscountCode,
  CreatorDiscountCodeInput,
  CreatorProfilePatch,
  CreatorProfileSettings,
  CreatorProductMetadata,
  CreatorRecommendation,
  CreatorRecommendationInput,
  CreatorStorefrontConfiguration,
  CreatorStorefrontConfigurationInput,
  CreatorStudioSummary,
  StorefrontTheme,
  StorefrontThemeConfiguration,
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
  categories: CategoryCard[];
  configuration: CreatorStorefrontConfiguration;
  discounts: CreatorDiscountCode[];
  profile: CreatorProfileSettings;
  recommendations: CreatorRecommendation[];
  summary: CreatorStudioSummary;
  theme: StorefrontThemeConfiguration;
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
  const [
    summary,
    profile,
    brands,
    categories,
    discounts,
    recommendations,
    configuration,
    analytics,
    theme,
  ] = await Promise.all([
    creatorRequest('/v1/creator/studio', creatorStudioSummarySchema.parse),
    creatorRequest('/v1/creator/profile', creatorProfileSettingsSchema.parse),
    creatorRequest('/v1/creator/brands', (value) =>
      creatorBrandSchema.array().parse(value),
    ),
    creatorRequest('/v1/creator/categories', (value) =>
      categoryCardSchema.array().parse(value),
    ),
    creatorRequest('/v1/creator/discount-codes', (value) =>
      creatorDiscountCodeSchema.array().parse(value),
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
    creatorRequest(
      '/v1/creator/studio/storefront-theme',
      storefrontThemeConfigurationSchema.parse,
    ),
  ]);

  return {
    analytics,
    brands,
    categories,
    configuration,
    discounts,
    profile,
    recommendations,
    summary,
    theme,
  };
}

export function saveCreatorDiscount(
  input: CreatorDiscountCodeInput,
  discount?: CreatorDiscountCode,
): Promise<CreatorDiscountCode> {
  return creatorRequest(
    discount ? `/v1/creator/discount-codes/${discount.id}` : '/v1/creator/discount-codes',
    creatorDiscountCodeSchema.parse,
    {
      body: JSON.stringify(input),
      headers: discount
        ? { 'if-match': `"${discount.version}"` }
        : { 'idempotency-key': Crypto.randomUUID() },
      method: discount ? 'PATCH' : 'POST',
    },
  );
}

export function createCreatorCategory(name: string): Promise<CategoryCard> {
  return creatorRequest('/v1/creator/categories', categoryCardSchema.parse, {
    body: JSON.stringify({ name }),
    method: 'POST',
  });
}

export function transitionCreatorDiscount(
  discount: CreatorDiscountCode,
  command: 'archive' | 'confirm' | 'hide',
): Promise<CreatorDiscountCode> {
  return creatorRequest(
    `/v1/creator/discount-codes/${discount.id}/${command}`,
    creatorDiscountCodeSchema.parse,
    {
      headers: {
        'idempotency-key': Crypto.randomUUID(),
        'if-match': `"${discount.version}"`,
      },
      method: 'POST',
    },
  );
}

export function fetchCreatorProductDetails(url: string): Promise<CreatorProductMetadata> {
  return creatorRequest(
    '/v1/creator/recommendations/fetch-details',
    creatorProductMetadataSchema.parse,
    { body: JSON.stringify({ url }), method: 'POST' },
  );
}

export function saveCreatorRecommendation(
  input: CreatorRecommendationInput,
  recommendation?: CreatorRecommendation,
): Promise<CreatorRecommendation> {
  return creatorRequest(
    recommendation
      ? `/v1/creator/recommendations/${recommendation.id}`
      : '/v1/creator/recommendations',
    creatorRecommendationSchema.parse,
    {
      body: JSON.stringify(input),
      headers: recommendation
        ? { 'if-match': `"${recommendation.version}"` }
        : { 'idempotency-key': Crypto.randomUUID() },
      method: recommendation ? 'PATCH' : 'POST',
    },
  );
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

export async function getCreatorHandleAvailability(handle: string): Promise<boolean> {
  const result = await creatorRequest(
    `/v1/creator/profile/handle-availability?handle=${encodeURIComponent(handle)}`,
    creatorHandleAvailabilitySchema.parse,
  );
  return result.available;
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

export async function archiveCreatorBrand(
  brand: CreatorBrand,
  archiveRecommendations: boolean,
): Promise<void> {
  await creatorRequest(
    `/v1/creator/brands/${brand.id}?archiveRecommendations=${String(archiveRecommendations)}`,
    (value) => {
      if (
        !value ||
        typeof value !== 'object' ||
        !('deleted' in value) ||
        value.deleted !== true
      ) {
        throw new Error('Unexpected brand archive response');
      }
    },
    {
      headers: { 'if-match': `"${brand.version}"` },
      method: 'DELETE',
    },
  );
}

export function transitionCreatorRecommendation(
  recommendation: CreatorRecommendation,
  command: 'archive' | 'publish' | 'unpublish' | 'restore',
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

export function getCreatorAnalytics(days: 7 | 30): Promise<CreatorAnalyticsDashboard> {
  return creatorRequest(
    `/v1/creator/analytics?days=${days}`,
    creatorAnalyticsDashboardSchema.parse,
  );
}

export function saveStorefrontTheme(
  configuration: StorefrontThemeConfiguration,
  theme: StorefrontTheme,
): Promise<StorefrontThemeConfiguration> {
  return creatorRequest(
    '/v1/creator/studio/storefront-theme',
    storefrontThemeConfigurationSchema.parse,
    {
      body: JSON.stringify(theme),
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
