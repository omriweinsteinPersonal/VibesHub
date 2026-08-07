import { describe, expect, it } from 'vitest';

import { parseApiConfig } from './config.js';

describe('API configuration', () => {
  it('provides safe local defaults', () => {
    expect(parseApiConfig({})).toMatchObject({
      corsOrigins: ['http://localhost:3000'],
      host: '0.0.0.0',
      nodeEnv: 'development',
      port: 4000,
    });
  });

  it('parses a comma-separated CORS allow list', () => {
    expect(
      parseApiConfig({
        CORS_ORIGINS: 'https://vibeshub.co.il, https://www.vibeshub.co.il',
      }).corsOrigins,
    ).toEqual(['https://vibeshub.co.il', 'https://www.vibeshub.co.il']);
  });

  it('fails closed when production identity infrastructure is missing', () => {
    expect(() => parseApiConfig({ NODE_ENV: 'production' })).toThrow(
      'DATABASE_URL, SUPABASE_URL, and SUPABASE_PUBLISHABLE_KEY are required in production',
    );
  });
});
