import { describe, expect, it, vi, beforeEach } from 'vitest';
import { defaultStorefrontTheme, storefrontThemeSchema } from '@vibeshub/contracts';
import { apiRequest } from './api';
import { moveKey, orderedKeys, persistStorefrontLayout } from './storefront-layout';

vi.mock('./api', () => ({ apiRequest: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
describe('storefront layout', () => {
  it('keeps the original order for existing pages without a layout', () => {
    expect(orderedKeys(['profile', 'bio', 'social:instagram', 'brand:a'])).toEqual([
      'profile',
      'bio',
      'social:instagram',
      'brand:a',
    ]);
    expect(storefrontThemeSchema.parse(defaultStorefrontTheme).layout).toBeUndefined();
  });
  it('moves bio below platforms and brands across recommendations without mutating inputs', () => {
    const source = ['bio', 'social:instagram', 'content:a', 'brand:a'];
    expect(moveKey(source, 'bio', 'social:instagram')).toEqual([
      'social:instagram',
      'bio',
      'content:a',
      'brand:a',
    ]);
    expect(moveKey(source, 'brand:a', 'content:a')).toEqual([
      'bio',
      'social:instagram',
      'brand:a',
      'content:a',
    ]);
    expect(source[0]).toBe('bio');
  });
  it('moves independent social icons to either end of a page', () => {
    const keys = ['profile', 'social:tiktok', 'bio', 'brand:a', 'social:instagram'];
    expect(moveKey(keys, 'social:instagram', 'profile')[0]).toBe('social:instagram');
    expect(moveKey(keys, 'social:tiktok', 'social:instagram').at(-1)).toBe(
      'social:tiktok',
    );
  });
  it('ignores removed and duplicate keys while including newly added blocks', () => {
    expect(
      orderedKeys(
        ['bio', 'brand:new', 'social:instagram'],
        ['social:instagram', 'deleted', 'bio', 'bio'],
      ),
    ).toEqual(['social:instagram', 'bio', 'brand:new']);
  });
  it('does not lose content for invalid or cancelled moves', () => {
    expect(moveKey(['a', 'b'], 'missing', 'a')).toEqual(['a', 'b']);
    expect(moveKey(['a', 'b'], 'a', 'a')).toEqual(['a', 'b']);
  });
  it('validates and round-trips layout inside the existing theme JSON', () => {
    const layout = {
      blocks: ['social:instagram', 'bio', 'brand:a'],
      labels: ['b91d82c7-3340-4ffa-8745-a45b59c17621'],
    };
    expect(
      storefrontThemeSchema.parse(
        JSON.parse(JSON.stringify({ ...defaultStorefrontTheme, layout })),
      ).layout,
    ).toEqual(layout);
    expect(
      storefrontThemeSchema.safeParse({
        ...defaultStorefrontTheme,
        layout: { ...layout, labels: ['invalid'] },
      }).success,
    ).toBe(false);
  });
  it('saves with the latest version and preserves concurrent palette changes', async () => {
    const latestTheme = { ...defaultStorefrontTheme, accentColor: '#775566' };
    const layout = { blocks: ['bio', 'profile'], labels: [] };
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ theme: latestTheme, version: 7 })
      .mockResolvedValueOnce({ theme: { ...latestTheme, layout }, version: 8 });
    const saved = await persistStorefrontLayout(layout);
    expect(apiRequest).toHaveBeenLastCalledWith('/creator/studio/storefront-theme', {
      method: 'PUT',
      headers: { 'if-match': '"7"' },
      body: JSON.stringify({ ...latestTheme, layout }),
    });
    expect(saved.version).toBe(8);
  });
  it('does not swallow version conflicts or failed saves', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ theme: defaultStorefrontTheme, version: 7 })
      .mockRejectedValueOnce(new Error('Version conflict'));
    await expect(
      persistStorefrontLayout({ blocks: ['bio'], labels: [] }),
    ).rejects.toThrow('Version conflict');
  });
});
