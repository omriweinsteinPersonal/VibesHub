import { describe, expect, it } from 'vitest';

import {
  normalizeMerchantHostname,
  trackedRedirectUrl,
  validateRedirectDestination,
} from './redirect-destination.js';

describe('tracked redirect destination boundaries', () => {
  it('normalizes a public HTTPS destination without changing its path or query', () => {
    expect(validateRedirectDestination('https://SHOP.Example.com/product?a=1')).toEqual({
      destinationUrl: 'https://shop.example.com/product?a=1',
      hostname: 'shop.example.com',
    });
  });

  it.each([
    'http://shop.example.com/product',
    'https://user:secret@shop.example.com/product',
    'https://127.0.0.1/product',
    'https://localhost/product',
    'https://merchant.local/product',
    'https://shop.example.com:8443/product',
  ])('rejects unsafe destination %s', (destination) => {
    expect(() => validateRedirectDestination(destination)).toThrow();
  });

  it('normalizes international domain names to their ASCII identity', () => {
    expect(normalizeMerchantHostname('BÜCHER.example')).toBe('xn--bcher-kva.example');
  });

  it('builds a redirect URL from server-owned values only', () => {
    expect(
      trackedRedirectUrl(
        'https://api.vibeshub.com',
        '01989f72-07e4-7f32-9b42-1ba55d4ca023',
      ),
    ).toBe('https://api.vibeshub.com/go/01989f72-07e4-7f32-9b42-1ba55d4ca023');
  });
});
