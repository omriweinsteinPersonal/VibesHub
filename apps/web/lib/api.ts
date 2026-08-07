import { getApiUrl } from './config';
import { getSupabaseBrowserClient } from './supabase-browser';

interface ProblemDetails {
  detail?: string;
  title?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { idempotent?: boolean } = {},
): Promise<T> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ApiError('Please log in to continue.', 401);

  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${data.session.access_token}`);
  if (init.body) headers.set('content-type', 'application/json');
  if (init.idempotent) headers.set('idempotency-key', crypto.randomUUID());

  return request<T>(path, { ...init, headers });
}

export function publicApiRequest<T>(path: string): Promise<T> {
  return request<T>(path);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiUrl()}/v1${path}`, init);
  const body = (await response.json()) as { data?: T } & ProblemDetails;
  if (!response.ok) {
    throw new ApiError(
      body.detail ?? body.title ?? 'The request failed.',
      response.status,
    );
  }
  return body.data as T;
}
