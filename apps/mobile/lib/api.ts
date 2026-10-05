import {
  creatorCardSchema,
  creatorStorefrontSchema,
  publicDiscountCodeSchema,
  recommendationCardSchema,
} from '@vibeshub/contracts';
import type {
  CreatorCard,
  CreatorStorefront,
  PublicDiscountCode,
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

export async function deleteCurrentAccount(): Promise<void> {
  const response = await authenticatedRequest('/v1/me', { method: 'DELETE' });
  if (response.ok) return;

  throw await apiError(response, 'Account deletion failed.');
}

export async function getBillingSummary(): Promise<BillingSummary> {
  const response = await authenticatedRequest('/v1/billing');
  if (!response.ok) throw await apiError(response, 'Billing status could not be loaded.');
  const body = (await response.json()) as { data: BillingSummary };
  return body.data;
}

export async function getCreators(): Promise<CreatorCard[]> {
  const data = await publicCollectionRequest('/v1/creators?limit=48');
  return creatorCardSchema.array().parse(data);
}

export async function getPublicStorefront(handle: string): Promise<CreatorStorefront> {
  const data = await publicRequest(`/v1/creators/${encodeURIComponent(handle)}`);
  return creatorStorefrontSchema.parse(data);
}

export async function getStorefrontRecommendations(
  handle: string,
): Promise<RecommendationCard[]> {
  const data = await publicCollectionRequest(
    `/v1/creators/${encodeURIComponent(handle)}/recommendations?limit=48`,
  );
  return recommendationCardSchema.array().parse(data);
}

export async function getStorefrontDiscountCodes(
  handle: string,
): Promise<PublicDiscountCode[]> {
  const data = await publicCollectionRequest(
    `/v1/creators/${encodeURIComponent(handle)}/discount-codes`,
  );
  return publicDiscountCodeSchema.array().parse(data);
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

async function publicRequest(path: string): Promise<unknown> {
  const response = await fetchWithTimeout(`${getApiUrl()}${path}`);
  const body = (await response.json().catch(() => null)) as
    ({ data?: unknown } & ApiProblem) | null;
  if (!response.ok) throw responseError(response.status, body, 'The request failed.');
  return body?.data;
}

async function publicCollectionRequest(path: string): Promise<unknown[]> {
  const response = await fetchWithTimeout(`${getApiUrl()}${path}`);
  const body = (await response.json().catch(() => null)) as
    ({ data?: unknown[] } & ApiProblem) | null;
  if (!response.ok) throw responseError(response.status, body, 'The request failed.');
  return body?.data ?? [];
}

async function fetchWithTimeout(input: string): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), defaultRequestTimeoutMs);
  try {
    return await fetch(input, { signal: controller.signal });
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
