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

async function apiError(response: Response, fallback: string): Promise<Error> {
  const problem = (await response.json().catch(() => null)) as ApiProblem | null;
  return new Error(problem?.detail ?? problem?.message ?? problem?.title ?? fallback);
}
