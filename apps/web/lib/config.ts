export function getSupabasePublicConfig(): { publishableKey: string; url: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error('Supabase public environment variables are not configured');
  }
  return { publishableKey, url };
}

export function getApiUrl(): string {
  // Browser mutations go through the Swavii origin. This avoids cross-origin
  // PATCH failures on mobile browsers while keeping server rendering pointed
  // directly at the API.
  if (typeof window !== 'undefined') return '/api/backend';
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}
