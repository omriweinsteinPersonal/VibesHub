import { z } from 'zod';

const environmentSchema = z.object({
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().trim().min(1).optional(),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(4000),
  SUPABASE_ANON_KEY: z.string().trim().min(1).optional(),
  SUPABASE_URL: z.url().optional(),
});

export interface ApiConfig {
  corsOrigins: string[];
  databaseUrl?: string;
  host: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  supabaseAnonKey?: string;
  supabaseUrl?: string;
}

export function parseApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const parsed = environmentSchema.parse(environment);

  const config: ApiConfig = {
    corsOrigins: parsed.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    host: parsed.HOST,
    logLevel: parsed.LOG_LEVEL,
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
  };

  if (parsed.DATABASE_URL) config.databaseUrl = parsed.DATABASE_URL;
  if (parsed.SUPABASE_ANON_KEY) config.supabaseAnonKey = parsed.SUPABASE_ANON_KEY;
  if (parsed.SUPABASE_URL) config.supabaseUrl = parsed.SUPABASE_URL;

  if (
    parsed.NODE_ENV === 'production' &&
    (!config.databaseUrl || !config.supabaseAnonKey || !config.supabaseUrl)
  ) {
    throw new Error(
      'DATABASE_URL, SUPABASE_URL, and SUPABASE_ANON_KEY are required in production',
    );
  }

  return config;
}
