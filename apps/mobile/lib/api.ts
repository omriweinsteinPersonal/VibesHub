import { getSupabaseClient } from './supabase';

interface ApiProblem {
  detail?: string;
  message?: string;
  title?: string;
}

function getApiUrl(): string {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!value) throw new Error('The Swavii API is not configured.');
  return value.replace(/\/$/, '');
}

export async function deleteCurrentAccount(): Promise<void> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Please log in again before deleting your account.');

  const response = await fetch(`${getApiUrl()}/v1/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    method: 'DELETE',
  });
  if (response.ok) return;

  const problem = (await response.json().catch(() => null)) as ApiProblem | null;
  throw new Error(
    problem?.detail ?? problem?.message ?? problem?.title ?? 'Account deletion failed.',
  );
}
