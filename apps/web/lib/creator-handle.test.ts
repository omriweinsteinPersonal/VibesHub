import { describe, expect, it } from 'vitest';

import {
  isCreatorHandle,
  normalizeCreatorHandle,
  suggestCreatorHandle,
} from './creator-handle';

describe('creator handles', () => {
  it('normalizes a creator chosen address', () => {
    expect(normalizeCreatorHandle('  Noa Levi! ')).toBe('noa-levi');
    expect(isCreatorHandle('noa-levi')).toBe(true);
  });

  it('suggests an address for a Hebrew display name', () => {
    expect(suggestCreatorHandle('עומרי ויינשטיין')).toBe('avmry-vyynshtyyn');
  });

  it('rejects incomplete and unsafe addresses', () => {
    expect(isCreatorHandle('a')).toBe(false);
    expect(isCreatorHandle('account/settings')).toBe(false);
  });
});
