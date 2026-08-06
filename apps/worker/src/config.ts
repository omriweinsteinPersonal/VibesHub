import { z } from 'zod';

const environmentSchema = z.object({
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(4001),
});

export type WorkerConfig = Readonly<{
  host: string;
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
}>;

export function parseWorkerConfig(environment: NodeJS.ProcessEnv): WorkerConfig {
  const parsed = environmentSchema.parse(environment);
  return { host: parsed.HOST, nodeEnv: parsed.NODE_ENV, port: parsed.PORT };
}
