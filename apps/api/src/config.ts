import { z } from 'zod';

const environmentSchema = z.object({
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(20).default(5),
  DATABASE_URL: z.string().trim().min(1).optional(),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(4000),
  REDIRECT_BASE_URL: z.url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1).optional(),
  SUPABASE_URL: z.url().optional(),
});

export interface ApiConfig {
  corsOrigins: string[];
  databasePoolMax: number;
  databaseUrl?: string;
  host: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  redirectBaseUrl: string;
  supabasePublishableKey?: string;
  supabaseServiceRoleKey?: string;
  supabaseUrl?: string;
}

export function parseApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const parsed = environmentSchema.parse(environment);
  const redirectBaseUrl =
    parsed.REDIRECT_BASE_URL ??
    (parsed.NODE_ENV === 'production' ? undefined : 'http://localhost:4000');

  if (
    parsed.NODE_ENV === 'production' &&
    (!parsed.DATABASE_URL ||
      !parsed.SUPABASE_PUBLISHABLE_KEY ||
      !parsed.SUPABASE_SERVICE_ROLE_KEY ||
      !parsed.SUPABASE_URL ||
      !redirectBaseUrl)
  ) {
    throw new Error(
      'DATABASE_URL, REDIRECT_BASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY are required in production',
    );
  }

  const config: ApiConfig = {
    corsOrigins: parsed.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    databasePoolMax: parsed.DATABASE_POOL_MAX,
    host: parsed.HOST,
    logLevel: parsed.LOG_LEVEL,
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    redirectBaseUrl: normalizeRedirectBaseUrl(
      redirectBaseUrl ?? 'http://localhost:4000',
      parsed.NODE_ENV,
    ),
  };

  if (parsed.DATABASE_URL) config.databaseUrl = parsed.DATABASE_URL;
  if (parsed.SUPABASE_PUBLISHABLE_KEY)
    config.supabasePublishableKey = parsed.SUPABASE_PUBLISHABLE_KEY;
  if (parsed.SUPABASE_SERVICE_ROLE_KEY)
    config.supabaseServiceRoleKey = parsed.SUPABASE_SERVICE_ROLE_KEY;
  if (parsed.SUPABASE_URL) config.supabaseUrl = parsed.SUPABASE_URL;

  return config;
}

function normalizeRedirectBaseUrl(value: string, nodeEnv: ApiConfig['nodeEnv']): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('REDIRECT_BASE_URL must be an origin without credentials or a path');
  }
  if (nodeEnv === 'production' && url.protocol !== 'https:') {
    throw new Error('REDIRECT_BASE_URL must use HTTPS in production');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('REDIRECT_BASE_URL must use HTTP or HTTPS');
  }
  return url.origin;
}
