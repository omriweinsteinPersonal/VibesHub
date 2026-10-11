import type { CreatorStorefront } from '@vibeshub/contracts';

export function storefrontIncludesBrandLogos(rawQuery: unknown): boolean {
  if (!rawQuery || typeof rawQuery !== 'object') return false;
  const value = (rawQuery as Record<string, unknown>).includeBrandLogos;
  return value === true || value === 'true' || value === '1';
}

export function storefrontResponse(
  storefront: CreatorStorefront,
  includeBrandLogos: boolean,
) {
  if (includeBrandLogos) return storefront;

  return {
    ...storefront,
    brands: storefront.brands.map(({ logoUrl: _logoUrl, ...brand }) => brand),
  };
}
