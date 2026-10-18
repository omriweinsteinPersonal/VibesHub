import { describe, expect, it } from 'vitest';

import { creatorWorkspaceTabs } from './creator-workspace';

describe('creator workspace navigation', () => {
  it('uses the same creator destinations and labels as the web workspace', () => {
    expect(creatorWorkspaceTabs.map(({ label }) => label)).toEqual([
      'Home',
      'Dashboard',
      'Storefront',
      'Analytics',
      'Account',
    ]);
  });
});
