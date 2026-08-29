import { Injectable } from '@nestjs/common';
import type { CreatorProductMetadata } from '@vibeshub/contracts';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { problem } from '../api-problem.js';

const maxRedirects = 3;
const maxHtmlBytes = 512 * 1_024;

// Vercel's Node function compiler does not include the DOM Response shape even
// though Node exposes fetch at runtime. Keep the boundary structural so the API
// compiles consistently in both the workspace and Vercel's function builder.
interface ProductFetchResponse {
  headers: { get(name: string): string | null };
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

@Injectable()
export class ProductMetadataService {
  async fetch(rawUrl: string): Promise<CreatorProductMetadata> {
    let url = await requirePublicHttpsUrl(rawUrl);
    for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
      const response = (await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'VibesHubProductPreview/1.0',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(8_000),
      }).catch(() => null)) as ProductFetchResponse | null;
      if (!response) {
        throw problem(
          422,
          'PRODUCT_DETAILS_UNAVAILABLE',
          'Product details could not be fetched',
        );
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirects === maxRedirects) {
          throw problem(
            422,
            'PRODUCT_DETAILS_UNAVAILABLE',
            'Product link redirected too many times',
          );
        }
        url = await requirePublicHttpsUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) {
        throw problem(
          422,
          'PRODUCT_DETAILS_UNAVAILABLE',
          'Product page did not return a usable response',
        );
      }
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (
        !contentType.includes('text/html') &&
        !contentType.includes('application/xhtml+xml')
      ) {
        throw problem(
          422,
          'PRODUCT_DETAILS_UNAVAILABLE',
          'Product link must return an HTML page',
        );
      }
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > maxHtmlBytes) {
        throw problem(
          422,
          'PRODUCT_DETAILS_UNAVAILABLE',
          'Product page is too large to preview',
        );
      }
      const html = (await response.text()).slice(0, maxHtmlBytes);
      return parseProductMetadata(html, url);
    }
    throw problem(
      422,
      'PRODUCT_DETAILS_UNAVAILABLE',
      'Product details could not be fetched',
    );
  }
}

async function requirePublicHttpsUrl(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw problem(422, 'UNSAFE_REDIRECT_DESTINATION', 'Use a valid HTTPS product link');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.hostname === 'localhost'
  ) {
    throw problem(422, 'UNSAFE_REDIRECT_DESTINATION', 'Use a public HTTPS product link');
  }
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true }).catch(() => []);
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw problem(
      422,
      'UNSAFE_REDIRECT_DESTINATION',
      'Use a publicly reachable product link',
    );
  }
  url.hash = '';
  return url.toString();
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized.includes(':')) {
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('2001:db8')
    );
  }
  const octets = normalized.split('.').map(Number);
  if (octets.length !== 4 || octets.some(Number.isNaN)) return true;
  const [a = 0, b = 0] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export function parseProductMetadata(
  html: string,
  productUrl: string,
): CreatorProductMetadata {
  const meta = new Map<string, string>();
  for (const tag of html.match(/<meta\s+[^>]*>/giu) ?? []) {
    const property =
      attribute(tag, 'property') ?? attribute(tag, 'name') ?? attribute(tag, 'itemprop');
    const content = attribute(tag, 'content');
    if (property && content) meta.set(property.toLowerCase(), decodeEntities(content));
  }
  const jsonLd = parseJsonLd(html);
  const image = firstString(jsonLd?.image) ?? meta.get('og:image') ?? null;
  const absoluteImage = image ? safeAbsoluteHttpsUrl(image, productUrl) : null;
  const price =
    firstString(jsonLd?.offers && objectValue(jsonLd.offers)?.price) ??
    meta.get('product:price:amount') ??
    null;
  return {
    brandName:
      namedEntity(jsonLd?.brand) ??
      namedEntity(jsonLd?.manufacturer) ??
      namedEntity(jsonLd?.vendor) ??
      meta.get('product:brand') ??
      meta.get('og:brand') ??
      meta.get('brand') ??
      meta.get('manufacturer') ??
      meta.get('og:site_name') ??
      brandFromProductUrl(productUrl),
    imageUrl: absoluteImage,
    priceAmountMinor:
      price && Number.isFinite(Number(price)) ? Math.round(Number(price) * 100) : null,
    productName:
      firstString(jsonLd?.name) ??
      meta.get('og:title') ??
      (decodeEntities(
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1]?.trim() ?? '',
      ) ||
        null),
    productUrl,
  };
}

function parseJsonLd(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu,
  )) {
    try {
      const parsed: unknown = JSON.parse(match[1] ?? 'null');
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const value of values) {
        const record = objectValue(value);
        if (!record) continue;
        const graph = Array.isArray(record['@graph']) ? record['@graph'] : [record];
        const product = graph.map(objectValue).find((item) => {
          const type = item?.['@type'];
          return type === 'Product' || (Array.isArray(type) && type.includes('Product'));
        });
        if (product) return product;
      }
    } catch {
      // Invalid merchant metadata should not prevent Open Graph fallbacks.
    }
  }
  return null;
}

function attribute(tag: string, name: string): string | null {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'iu'))?.[1] ?? null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) return value.map(firstString).find(Boolean) ?? null;
  return null;
}

function namedEntity(value: unknown): string | null {
  const direct = firstString(value);
  if (direct) return direct;
  if (Array.isArray(value)) {
    return value.map(namedEntity).find(Boolean) ?? null;
  }
  const record = objectValue(value);
  return record
    ? (firstString(record.name) ??
        firstString(record.legalName) ??
        firstString(record.alternateName))
    : null;
}

function brandFromProductUrl(productUrl: string): string | null {
  try {
    const labels = new URL(productUrl).hostname.replace(/^www\./iu, '').split('.');
    const publicSuffix = labels.at(-1) ?? '';
    const secondLevelDomain = labels.at(-2) ?? '';
    const usesCountryCodeSecondLevelDomain =
      publicSuffix.length === 2 &&
      ['ac', 'co', 'com', 'gov', 'net', 'org'].includes(secondLevelDomain);
    const brand = usesCountryCodeSecondLevelDomain
      ? labels.at(-3)
      : labels.length > 1
        ? secondLevelDomain
        : labels[0];
    if (!brand) return null;
    return brand
      .split(/[-_]/u)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return null;
  }
}

function safeAbsoluteHttpsUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function decodeEntities(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}
