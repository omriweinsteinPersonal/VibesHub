import { getApiUrl } from './config';

const loopbackHosts = new Set(['127.0.0.1', 'localhost']);

export function publicShopUrl(value: string): string {
  try {
    const destination = new URL(value);
    if (!loopbackHosts.has(destination.hostname)) return value;

    const api = new URL(getApiUrl());
    destination.protocol = api.protocol;
    destination.hostname = api.hostname;
    destination.port = api.port;
    destination.pathname = `${api.pathname.replace(/\/$/, '')}${destination.pathname}`;
    return destination.toString();
  } catch {
    return value;
  }
}
