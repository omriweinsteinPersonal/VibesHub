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
    const shopify = await fetchShopifyProductMetadata(url);
    if (shopify) return shopify;
    const adidas = await fetchAdidasProductMetadata(url);
    if (adidas) return adidas;
    for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
      const fallback = productMetadataFromUrl(url);
      const response = (await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'he-IL,he;q=0.9,en;q=0.8',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(8_000),
      }).catch(() => null)) as ProductFetchResponse | null;
      if (!response) {
        return fallback;
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirects === maxRedirects) {
          return fallback;
        }
        url = await requirePublicHttpsUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) {
        return fallback;
      }
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (
        !contentType.includes('text/html') &&
        !contentType.includes('application/xhtml+xml')
      ) {
        return fallback;
      }
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > maxHtmlBytes) {
        return fallback;
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

async function fetchShopifyProductMetadata(
  productUrl: string,
): Promise<CreatorProductMetadata | null> {
  const url = new URL(productUrl);
  const productMatch = url.pathname.match(/\/products\/([^/]+)\/?$/u);
  if (!productMatch?.[1]) return null;
  const endpoint = new URL(`/products/${productMatch[1]}.js`, url.origin);
  const response = (await fetch(endpoint, {
    headers: {
      accept: 'application/json',
      'accept-language': 'he-IL,he;q=0.9,en;q=0.8',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null)) as ProductFetchResponse | null;
  if (!response?.ok) return null;
  try {
    const product = objectValue(JSON.parse(await response.text()));
    if (!product) return null;
    const title = firstString(product.title);
    const description = primaryShopifyDescription(
      firstString(product.description),
      title,
    );
    const imageUrls = uniqueHttpsUrls(strings(product.images), productUrl);
    const price = product.price;
    return {
      brandName: brandFromProductUrl(productUrl) ?? firstString(product.vendor),
      categorySlug: suggestCategorySlug([
        title,
        description,
        firstString(product.type),
        ...strings(product.tags),
        decodeURIComponent(url.pathname),
      ]),
      description,
      imageUrl: imageUrls[0] ?? null,
      imageUrls,
      priceAmountMinor:
        typeof price === 'number' && Number.isFinite(price) ? Math.round(price) : null,
      productName: title ?? productNameFromUrl(productUrl),
      productUrl,
    };
  } catch {
    return null;
  }
}

function primaryShopifyDescription(description: string | null, title: string | null) {
  if (!description) return null;
  const lines = decodeEntities(
    description
      .replace(/<br\s*\/?\s*>/giu, '\n')
      .replace(/<\/p\s*>/giu, '\n')
      .replace(/<[^>]+>/gu, ''),
  )
    .split(/\n+/u)
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
  const narrative = lines.filter((line) => line !== title);
  const specificationIndex = narrative.findIndex((line) =>
    /^(?:מפרט טכני|technical specifications?)\s*:?$/iu.test(line),
  );
  return (
    (specificationIndex >= 0 ? narrative.slice(0, specificationIndex) : narrative)
      .join('\n\n')
      .slice(0, 2_000) || null
  );
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
  const imageUrls = uniqueHttpsUrls(
    [absoluteImage, ...strings(jsonLd?.image)].filter((value): value is string =>
      Boolean(value),
    ),
    productUrl,
  );
  const price = offerPrice(jsonLd?.offers) ?? meta.get('product:price:amount') ?? null;
  return {
    brandName:
      meta.get('og:site_name') ??
      namedEntity(jsonLd?.brand) ??
      namedEntity(jsonLd?.manufacturer) ??
      namedEntity(jsonLd?.vendor) ??
      meta.get('product:brand') ??
      meta.get('og:brand') ??
      meta.get('brand') ??
      meta.get('manufacturer') ??
      brandFromProductUrl(productUrl),
    categorySlug: suggestCategorySlug([
      firstString(jsonLd?.name),
      firstString(jsonLd?.description),
      meta.get('og:title') ?? null,
      meta.get('og:description') ?? null,
      decodeURIComponent(new URL(productUrl).pathname),
    ]),
    description:
      firstString(jsonLd?.description) ??
      meta.get('og:description') ??
      meta.get('description') ??
      null,
    imageUrl: absoluteImage,
    imageUrls,
    priceAmountMinor: priceAmountMinor(price),
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

export function productMetadataFromUrl(productUrl: string): CreatorProductMetadata {
  return {
    brandName: brandFromProductUrl(productUrl),
    categorySlug: suggestCategorySlug([decodeURIComponent(new URL(productUrl).pathname)]),
    description: null,
    imageUrl: null,
    imageUrls: [],
    priceAmountMinor: null,
    productName: productNameFromUrl(productUrl),
    productUrl,
  };
}

async function fetchAdidasProductMetadata(
  productUrl: string,
): Promise<CreatorProductMetadata | null> {
  const url = new URL(productUrl);
  if (!/(^|\.)adidas\.co\.il$/iu.test(url.hostname)) return null;
  const productCode = decodeURIComponent(url.pathname).match(
    /\/([a-z0-9_-]+)\.html$/iu,
  )?.[1];
  if (!productCode) return null;
  const endpoint = new URL(
    '/on/demandware.store/Sites-adidas-IL-Site/he_IL/Product-ShowQuickView',
    url,
  );
  endpoint.searchParams.set('pid', productCode);
  const response = (await fetch(endpoint, {
    headers: {
      accept: 'application/json',
      'accept-language': 'he-IL,he;q=0.9,en;q=0.8',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null)) as ProductFetchResponse | null;
  if (!response?.ok) return null;
  try {
    const payload = objectValue(JSON.parse(await response.text()));
    const product = objectValue(payload?.product);
    if (!product) return null;
    const price = objectValue(objectValue(product.price)?.sales)?.value;
    const images = objectValue(product.images)?.zoom;
    const imageUrls = uniqueHttpsUrls(
      Array.isArray(images)
        ? images.map((entry) => firstString(objectValue(entry)?.url)).filter(isString)
        : [],
      productUrl,
    );
    return {
      brandName: firstString(product.brand) ?? 'Adidas',
      categorySlug: suggestCategorySlug([
        firstString(product.productName),
        firstString(product.shortDescription),
        firstString(product.longDescription),
        decodeURIComponent(url.pathname),
      ]),
      description:
        firstString(product.shortDescription) ?? firstString(product.longDescription),
      imageUrl: imageUrls[0] ?? null,
      imageUrls,
      priceAmountMinor:
        typeof price === 'number' && Number.isFinite(price)
          ? Math.round(price * 100)
          : null,
      productName: firstString(product.productName) ?? productNameFromUrl(productUrl),
      productUrl,
    };
  } catch {
    return null;
  }
}

const categorySignals: ReadonlyArray<[string, RegExp]> = [
  [
    'food',
    /(?:food|kitchen|cook|grill|toaster|sandwich|coffee|recipe|restaurant|מטבח|בישול|גריל|טוסטר|כריכים|מזון|אוכל|קפה)/iu,
  ],
  ['beauty', /(?:beauty|makeup|cosmetic|lipstick|mascara|איפור|קוסמטיקה|שפתון|מסקרה)/iu],
  [
    'skincare',
    /(?:skincare|skin care|serum|moisturi[sz]er|cleanser|טיפוח|סרום|קרם פנים)/iu,
  ],
  [
    'fashion',
    /(?:fashion|dress|shirt|pants|shoes?|sneakers?|bag|clothing|אופנה|שמלה|חולצה|מכנס|נעל|תיק)/iu,
  ],
  ['fitness', /(?:fitness|workout|training|gym|כושר|אימון|חדר כושר)/iu],
  [
    'sports',
    /(?:sport|football|basketball|tennis|running|ספורט|כדורגל|כדורסל|טניס|ריצה)/iu,
  ],
  [
    'technology',
    /(?:technology|electronic|computer|phone|tablet|headphones?|טכנולוגיה|אלקטרוניקה|מחשב|טלפון|אוזניות)/iu,
  ],
  [
    'home-decor',
    /(?:home decor|furniture|lamp|rug|sofa|עיצוב הבית|ריהוט|מנורה|שטיח|ספה)/iu,
  ],
  ['books', /(?:books?|novel|reading|ספרים?|רומן|קריאה)/iu],
  ['travel', /(?:travel|hotel|flight|luggage|טיול|מלון|טיסה|מזוודה)/iu],
  ['wellness', /(?:wellness|meditation|supplement|vitamin|בריאות|מדיטציה|תוסף|ויטמין)/iu],
  [
    'accessories-jewelry',
    /(?:jewel(?:ry|lery)|necklace|bracelet|watch|תכשיט|שרשרת|צמיד|שעון)/iu,
  ],
  ['kids-baby', /(?:kids?|baby|children|toys?|ילדים|תינוק|צעצוע)/iu],
  ['pets', /(?:pets?|dog|cat|כלבים?|חתולים?|חיות מחמד)/iu],
  ['gaming', /(?:gaming|video game|playstation|xbox|גיימינג|משחקי וידאו|פלייסטיישן)/iu],
];

export function suggestCategorySlug(values: Array<string | null>): string | null {
  const searchable = values.filter(isString).join(' ');
  return categorySignals.find(([, pattern]) => pattern.test(searchable))?.[0] ?? null;
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

function strings(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (Array.isArray(value)) return value.flatMap(strings);
  const record = objectValue(value);
  return record ? strings(record.url) : [];
}

function isString(value: string | null): value is string {
  return Boolean(value);
}

function uniqueHttpsUrls(values: string[], base: string): string[] {
  return [
    ...new Set(values.map((value) => safeAbsoluteHttpsUrl(value, base)).filter(isString)),
  ].slice(0, 10);
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

function offerPrice(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(offerPrice).find(Boolean) ?? null;
  }
  const offer = objectValue(value);
  if (!offer) return null;
  return (
    offer.price ?? offer.lowPrice ?? objectValue(offer.priceSpecification)?.price ?? null
  );
}

function priceAmountMinor(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim().replace(/[^0-9,.-]/gu, '');
  if (!raw) return null;
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);
  const normalized =
    decimalIndex >= 0
      ? `${raw.slice(0, decimalIndex).replaceAll(/[,.]/gu, '')}.${raw.slice(decimalIndex + 1)}`
      : raw.replaceAll(/[,.]/gu, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function productNameFromUrl(productUrl: string): string | null {
  try {
    const segments = new URL(productUrl).pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment).trim())
      .filter(Boolean);
    let candidate = segments.at(-1) ?? '';
    if (/^[a-z]{0,4}\d[a-z0-9_-]*\.html$/iu.test(candidate) && segments.length > 1) {
      candidate = segments.at(-2) ?? candidate;
    }
    candidate = candidate.replace(/\.(?:html?|php|aspx?)$/iu, '').replace(/[-_]+/gu, ' ');
    return candidate.trim() || null;
  } catch {
    return null;
  }
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
    const knownBrands: Record<string, string> = {
      adidas: 'Adidas',
      'foodappeal-online': 'Food Appeal',
      fox: 'Fox',
      terminalx: 'Terminal X',
      weshoes: 'WeShoes',
    };
    if (knownBrands[brand.toLowerCase()]) return knownBrands[brand.toLowerCase()] ?? null;
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
