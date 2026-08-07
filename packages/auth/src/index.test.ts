import { describe, expect, it } from 'vitest';

import { hasCapability, type Capability } from './index.js';

describe('platform capabilities', () => {
  it('allows explicitly granted capabilities', () => {
    const granted = new Set<Capability>(['moderator:review_content']);

    expect(hasCapability(granted, 'moderator:review_content')).toBe(true);
    expect(hasCapability(granted, 'creator:manage_content')).toBe(false);
  });

  it('lets platform administrators satisfy every capability check', () => {
    const granted = new Set<Capability>(['admin:manage_platform']);

    expect(hasCapability(granted, 'shopper:save')).toBe(true);
    expect(hasCapability(granted, 'creator:view_analytics')).toBe(true);
    expect(hasCapability(granted, 'moderator:review_content')).toBe(true);
  });
});
