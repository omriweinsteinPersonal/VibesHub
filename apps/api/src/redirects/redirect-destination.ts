import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';

const hostnamePattern =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export interface ValidatedDestination {
  destinationUrl: string;
  hostname: string;
}

export function validateRedirectDestination(value: string): ValidatedDestination {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('UNSAFE_REDIRECT_DESTINATION');
  }

  const hostname = normalizeMerchantHostname(url.hostname);
  if (url.hostname.endsWith('.')) throw new Error('UNSAFE_REDIRECT_DESTINATION');
  url.hostname = hostname;

  return { destinationUrl: url.toString(), hostname };
}

export function normalizeMerchantHostname(value: string): string {
  const hostname = domainToASCII(value.trim().toLowerCase());
  if (
    !hostname ||
    isIP(hostname) !== 0 ||
    !hostnamePattern.test(hostname) ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('INVALID_MERCHANT_HOSTNAME');
  }
  return hostname;
}

export function trackedRedirectUrl(baseUrl: string, publicId: string): string {
  return `${baseUrl}/go/${encodeURIComponent(publicId)}`;
}
