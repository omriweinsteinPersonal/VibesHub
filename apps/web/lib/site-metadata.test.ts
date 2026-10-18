import { describe, expect, it } from 'vitest';

import {
  organizationStructuredData,
  siteName,
  siteUrl,
  websiteStructuredData,
} from './site-metadata';

describe('site identity metadata', () => {
  it('uses the canonical Swavii name and production domain everywhere', () => {
    expect(siteName).toBe('Swavii');
    expect(siteUrl).toBe('https://swavii.com');
    expect(websiteStructuredData).toMatchObject({
      '@type': 'WebSite',
      name: 'Swavii',
      url: 'https://swavii.com/',
    });
    expect(organizationStructuredData).toMatchObject({
      '@type': 'Organization',
      name: 'Swavii',
      url: 'https://swavii.com/',
    });
  });
});
