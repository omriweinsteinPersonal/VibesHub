import { getApiUrl } from './config';
import { randomUuid } from './random-id';
import { getSupabaseBrowserClient } from './supabase-browser';

interface ProblemDetails {
  detail?: string;
  errors?: Array<{ field?: string; message?: string }>;
  title?: string;
}

type ApiRequestInit = RequestInit & {
  idempotent?: boolean;
  timeoutMs?: number;
};

const defaultRequestTimeoutMs = 20_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ApiError('Please log in to continue.', 401);

  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${data.session.access_token}`);
  if (init.body) headers.set('content-type', 'application/json');
  if (init.idempotent) headers.set('idempotency-key', randomUuid());

  return request<T>(path, { ...init, headers }, init.timeoutMs);
}

export async function apiCollectionRequest<T>(path: string): Promise<{
  data: T[];
  page: { hasMore: boolean; nextCursor: string | null };
}> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ApiError('Please log in to continue.', 401);

  return collectionRequest<T>(path, {
    headers: { authorization: `Bearer ${data.session.access_token}` },
  });
}

export function publicApiRequest<T>(path: string): Promise<T> {
  return request<T>(path);
}

export async function publicApiCollectionRequest<T>(path: string): Promise<{
  data: T[];
  page: { hasMore: boolean; nextCursor: string | null };
}> {
  return collectionRequest<T>(path);
}

async function collectionRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<{
  data: T[];
  page: { hasMore: boolean; nextCursor: string | null };
}> {
  const response = await fetchWithTimeout(`${getApiUrl()}/v1${path}`, init);
  const body = (await response.json()) as {
    data?: T[];
    page?: { hasMore: boolean; nextCursor: string | null };
  } & ProblemDetails;
  if (!response.ok) {
    throw new ApiError(problemMessage(body), response.status);
  }
  return {
    data: body.data ?? [],
    page: body.page ?? { hasMore: false, nextCursor: null },
  };
}

async function request<T>(
  path: string,
  init?: ApiRequestInit,
  timeoutMs = defaultRequestTimeoutMs,
): Promise<T> {
  const response = await fetchWithTimeout(`${getApiUrl()}/v1${path}`, init, timeoutMs);
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as { data?: T } & ProblemDetails;
  if (!response.ok) {
    throw new ApiError(problemMessage(body), response.status);
  }
  return body.data as T;
}

async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs = defaultRequestTimeoutMs,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init?.signal;
  let timedOut = false;
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (cause) {
    if (timedOut) {
      throw new ApiError('The request took too long. Please try again.', 408);
    }
    throw cause;
  } finally {
    globalThis.clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

function problemMessage(body: ProblemDetails): string {
  const issue = body.errors?.[0];
  if (issue?.message) {
    return `${issue.field ? `${issue.field}: ` : ''}${issue.message}`;
  }
  return body.detail ?? body.title ?? 'The request failed.';
}
