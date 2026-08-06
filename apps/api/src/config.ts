import { z } from 'zod';

const environmentSchema = z.object({
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(4000),
});

export interface ApiConfig {
  corsOrigins: string[];
  host: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
}

export function parseApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const parsed = environmentSchema.parse(environment);

  return {
    corsOrigins: parsed.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    host: parsed.HOST,
    logLevel: parsed.LOG_LEVEL,
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
  };
}
