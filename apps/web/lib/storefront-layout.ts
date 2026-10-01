import type { StorefrontTheme, StorefrontThemeConfiguration } from '@vibeshub/contracts';
import { apiRequest } from './api';

export async function persistStorefrontLayout(
  layout: NonNullable<StorefrontTheme['layout']>,
) {
  const latest = await apiRequest<StorefrontThemeConfiguration>(
    '/creator/studio/storefront-theme',
  );
  return apiRequest<StorefrontThemeConfiguration>('/creator/studio/storefront-theme', {
    method: 'PUT',
    headers: { 'if-match': `"${latest.version}"` },
    body: JSON.stringify({ ...latest.theme, layout }),
  });
}

/** Stable keys survive new/removed content without losing the creator's arrangement. */
export function orderedKeys(available: string[], saved: readonly string[] = []) {
  const valid = new Set(available);
  return [...new Set([...saved.filter((key) => valid.has(key)), ...available])];
}

export function moveKey(keys: readonly string[], source: string, target: string) {
  const from = keys.indexOf(source);
  const to = keys.indexOf(target);
  if (from < 0 || to < 0 || from === to) return [...keys];
  const next = [...keys];
  next.splice(from, 1);
  next.splice(to, 0, source);
  return next;
}
