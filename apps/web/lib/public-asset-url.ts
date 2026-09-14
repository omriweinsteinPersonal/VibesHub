import { getSupabasePublicConfig } from './config';

const loopbackHosts = new Set(['127.0.0.1', 'localhost']);

export function publicAssetUrl(value: string): string {
  try {
    const asset = new URL(value);
    if (!loopbackHosts.has(asset.hostname)) return value;

    const publicSupabase = new URL(getSupabasePublicConfig().url);
    asset.protocol = publicSupabase.protocol;
    asset.hostname = publicSupabase.hostname;
    asset.port = publicSupabase.port;
    return asset.toString();
  } catch {
    return value;
  }
}
