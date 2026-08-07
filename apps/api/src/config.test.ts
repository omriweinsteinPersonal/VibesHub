import { describe, expect, it } from 'vitest';

import { parseApiConfig } from './config.js';

describe('API configuration', () => {
  it('provides safe local defaults', () => {
    expect(parseApiConfig({})).toMatchObject({
      corsOrigins: ['http://localhost:3000'],
      databasePoolMax: 5,
      host: '0.0.0.0',
      nodeEnv: 'development',
      port: 4000,
      redirectBaseUrl: 'http://localhost:4000',
    });
  });

  it('caps the configured database pool size', () => {
    expect(parseApiConfig({ DATABASE_POOL_MAX: '4' }).databasePoolMax).toBe(4);
    expect(() => parseApiConfig({ DATABASE_POOL_MAX: '21' })).toThrow();
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
      'DATABASE_URL, REDIRECT_BASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY are required in production',
    );
  });

  it('requires a path-free HTTPS redirect origin in production', () => {
    expect(() =>
      parseApiConfig({
        DATABASE_URL: 'postgres://example',
        NODE_ENV: 'production',
        REDIRECT_BASE_URL: 'http://api.example.com',
        SUPABASE_PUBLISHABLE_KEY: 'publishable',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SUPABASE_URL: 'https://project.supabase.co',
      }),
    ).toThrow('REDIRECT_BASE_URL must use HTTPS in production');
    expect(() =>
      parseApiConfig({ REDIRECT_BASE_URL: 'https://api.example.com/go' }),
    ).toThrow('REDIRECT_BASE_URL must be an origin');
  });
});
