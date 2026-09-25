import { describe, expect, it } from 'vitest';

import { destinationForAccount, safeInternalPath } from './account-destination';

describe('safeInternalPath', () => {
  it('keeps local paths and rejects external-looking values', () => {
    expect(safeInternalPath('/account?tab=profile', '/creator-home')).toBe(
      '/account?tab=profile',
    );
    expect(safeInternalPath('//example.com', '/creator-home')).toBe('/creator-home');
    expect(safeInternalPath('/\\example.com', '/creator-home')).toBe('/creator-home');
    expect(safeInternalPath('https://example.com', '/creator-home')).toBe(
      '/creator-home',
    );
  });
});

describe('destinationForAccount', () => {
  it('sends creators directly to their requested workspace page', () => {
    const account = {
      capabilities: [],
      creator: { handle: 'noa', id: 'creator-id' },
    };

    expect(destinationForAccount(account, '/analytics')).toBe('/analytics');
    expect(destinationForAccount(account, '/creator/apply')).toBe('/creator-home');
  });

  it('routes platform operators and new creators to their setup areas', () => {
    expect(
      destinationForAccount(
        { capabilities: ['admin:manage_platform'], creator: null },
        '/creator-home',
      ),
    ).toBe('/admin/applications');
    expect(
      destinationForAccount({ capabilities: [], creator: null }, '/creator-home'),
    ).toBe('/creator/apply');
  });
});
