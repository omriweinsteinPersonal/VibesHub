import { describe, expect, it } from 'vitest';

import {
  destinationForAccount,
  isCreatorHandle,
  normalizeCreatorHandle,
  suggestCreatorHandle,
} from './creator-onboarding-routing';

describe('creator onboarding', () => {
  it('routes creators to the studio and new accounts to setup', () => {
    const base = { application: null, capabilities: [], id: 'user-id' };
    expect(destinationForAccount({ ...base, creator: null })).toBe('/creator-apply');
    expect(
      destinationForAccount({
        ...base,
        creator: { handle: 'noa', id: 'creator-id' },
      }),
    ).toBe('/studio');
  });

  it('creates valid handles from Latin and Hebrew names', () => {
    expect(suggestCreatorHandle('Noa Levi')).toBe('noa-levi');
    expect(suggestCreatorHandle('עומרי ויינשטיין')).toBe('avmry-vyynshtyyn');
    expect(normalizeCreatorHandle('  Hello World!  ')).toBe('hello-world');
    expect(isCreatorHandle('hello-world')).toBe(true);
    expect(isCreatorHandle('a')).toBe(false);
  });
});
