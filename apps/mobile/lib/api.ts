import {
  creatorCardSchema,
  creatorStorefrontSchema,
  publicRecommendationDetailSchema,
  publicDiscountCodeSchema,
  recommendationCardSchema,
} from '@vibeshub/contracts';
import type {
  ContentReportInput,
  ContentReportReceipt,
  CreatorCard,
  CreatorStorefront,
  PublicDiscountCode,
  PublicRecommendationDetail,
  RecommendationCard,
} from '@vibeshub/contracts';

import { getSupabaseClient } from './supabase';

interface ApiProblem {
  detail?: string;
  message?: string;
  title?: string;
}

export interface BillingSummary {
  customerId: string;
  entitlements: {
    active: boolean;
    expiresAt: string | null;
    key: string;
  }[];
}

const defaultRequestTimeoutMs = 20_000;
const publicCacheLifetimeMs = 2 * 60_000;
const publicCache = new Map<string, { data: unknown; expiresAt: number }>();
const publicRequests = new Map<string, Promise<unknown>>();

interface PublicRequestOptions {
  forceRefresh?: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function getApiUrl(): string {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!value) throw new Error('The Swavii API is not configured.');
  return value.replace(/\/$/, '');
}

export async function deleteCurrentAccount(
  input: { appleAuthorizationCode?: string } = {},
): Promise<void> {
  const response = await authenticatedRequest('/v1/me', {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'DELETE',
  });
  if (response.ok) return;

  throw await apiError(response, 'Account deletion failed.');
}

export async function createContentReport(
  input: ContentReportInput,
): Promise<ContentReportReceipt> {
  const response = await fetchWithTimeout(`${getApiUrl()}/v1/reports`, {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw await apiError(response, 'The report could not be sent.');
  const body = (await response.json()) as { data: ContentReportReceipt };
  return body.data;
}

export async function getBillingSummary(): Promise<BillingSummary> {
  const response = await authenticatedRequest('/v1/billing');
  if (!response.ok) throw await apiError(response, 'Billing status could not be loaded.');
  const body = (await response.json()) as { data: BillingSummary };
  return body.data;
}

export async function getCreators(
  options: PublicRequestOptions = {},
): Promise<CreatorCard[]> {
  const data = await publicCollectionRequest('/v1/creators?limit=48', options);
  return creatorCardSchema.array().parse(data);
}

export async function getPublicStorefront(
  handle: string,
  options: PublicRequestOptions = {},
): Promise<CreatorStorefront> {
  const data = await publicRequest(`/v1/creators/${encodeURIComponent(handle)}`, options);
  const parsed = creatorStorefrontSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError('This storefront could not be loaded. Please try again.', 502);
  }
  return parsed.data;
}

export async function getPublicRecommendation(
  id: string,
  options: PublicRequestOptions = {},
): Promise<PublicRecommendationDetail> {
  const data = await publicRequest(
    `/v1/discover/recommendations/${encodeURIComponent(id)}`,
    options,
  );
  const parsed = publicRecommendationDetailSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError('This recommendation could not be loaded. Please try again.', 502);
  }
  return parsed.data;
}

export async function getStorefrontRecommendations(
  handle: string,
  options: PublicRequestOptions = {},
): Promise<RecommendationCard[]> {
  const data = await publicCollectionRequest(
    `/v1/creators/${encodeURIComponent(handle)}/recommendations?limit=48`,
    options,
  );
  return recommendationCardSchema.array().parse(data);
}

export async function getStorefrontDiscountCodes(
  handle: string,
  options: PublicRequestOptions = {},
): Promise<PublicDiscountCode[]> {
  const data = await publicCollectionRequest(
    `/v1/creators/${encodeURIComponent(handle)}/discount-codes`,
    options,
  );
  return publicDiscountCodeSchema.array().parse(data);
}

export function readCachedPublicRecommendation(
  id: string,
): PublicRecommendationDetail | null {
  return readCached(
    `/v1/discover/recommendations/${encodeURIComponent(id)}`,
    publicRecommendationDetailSchema,
  );
}

export function readCachedPublicStorefront(handle: string): CreatorStorefront | null {
  return readCached(
    `/v1/creators/${encodeURIComponent(handle)}`,
    creatorStorefrontSchema,
  );
}

export function readCachedStorefrontRecommendations(
  handle: string,
): RecommendationCard[] | null {
  return readCached(
    `/v1/creators/${encodeURIComponent(handle)}/recommendations?limit=48`,
    recommendationCardSchema.array(),
  );
}

export function readCachedStorefrontDiscountCodes(
  handle: string,
): PublicDiscountCode[] | null {
  return readCached(
    `/v1/creators/${encodeURIComponent(handle)}/discount-codes`,
    publicDiscountCodeSchema.array(),
  );
}

async function authenticatedRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Please log in again.');

  return fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}

export async function prefetchPublicStorefront(handle: string): Promise<void> {
  await Promise.all([
    getPublicStorefront(handle),
    getStorefrontRecommendations(handle),
    getStorefrontDiscountCodes(handle),
  ]);
}

export async function prefetchPublicRecommendation(id: string): Promise<void> {
  await getPublicRecommendation(id);
}

async function publicRequest(
  path: string,
  options: PublicRequestOptions = {},
): Promise<unknown> {
  const cached = publicCache.get(path);
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  if (!options.forceRefresh) {
    const pending = publicRequests.get(path);
    if (pending) return pending;
  }

  const request = fetchPublicRequest(path);
  publicRequests.set(path, request);
  try {
    const data = await request;
    publicCache.set(path, { data, expiresAt: Date.now() + publicCacheLifetimeMs });
    return data;
  } finally {
    if (publicRequests.get(path) === request) publicRequests.delete(path);
  }
}

function readCached<T>(
  path: string,
  schema: { safeParse(value: unknown): { data?: T; success: boolean } },
): T | null {
  const cached = publicCache.get(path);
  if (!cached || cached.expiresAt <= Date.now()) return null;
  const parsed = schema.safeParse(cached.data);
  return parsed.success ? (parsed.data ?? null) : null;
}

async function fetchPublicRequest(path: string): Promise<unknown> {
  const response = await fetchWithTimeout(`${getApiUrl()}${path}`);
  const body = (await response.json().catch(() => null)) as
    ({ data?: unknown } & ApiProblem) | null;
  if (!response.ok) throw responseError(response.status, body, 'The request failed.');
  return body?.data;
}

async function publicCollectionRequest(
  path: string,
  options: PublicRequestOptions = {},
): Promise<unknown[]> {
  const data = await publicRequest(path, options);
  return Array.isArray(data) ? data : [];
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), defaultRequestTimeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new ApiError('The request took too long. Please try again.', 408);
    }
    throw cause;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function responseError(
  status: number,
  problem: ApiProblem | null,
  fallback: string,
): ApiError {
  return new ApiError(
    problem?.detail ?? problem?.message ?? problem?.title ?? fallback,
    status,
  );
}

async function apiError(response: Response, fallback: string): Promise<Error> {
  const problem = (await response.json().catch(() => null)) as ApiProblem | null;
  return responseError(response.status, problem, fallback);
}
