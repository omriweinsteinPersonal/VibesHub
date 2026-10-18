import { describe, expect, it } from 'vitest';

import { isCreatorHandle } from './creator-handle';

describe('isCreatorHandle', () => {
  it('accepts the same creator handles as the web workspace', () => {
    expect(isCreatorHandle('omri')).toBe(true);
    expect(isCreatorHandle('shahar_cohen')).toBe(true);
    expect(isCreatorHandle('יוצר-חדש')).toBe(true);
  });

  it('rejects unsafe and too-short storefront paths', () => {
    expect(isCreatorHandle('a')).toBe(false);
    expect(isCreatorHandle('creator/name')).toBe(false);
    expect(isCreatorHandle('creator?preview=true')).toBe(false);
  });
});
