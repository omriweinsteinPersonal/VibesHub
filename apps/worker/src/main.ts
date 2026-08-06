import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { logger } from '@vibeshub/observability';

import { AppModule } from './app.module.js';
import { parseWorkerConfig } from './config.js';

async function bootstrap(): Promise<void> {
  const config = parseWorkerConfig(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );

  app.enableShutdownHooks();
  await app.listen(config.port, config.host);
  logger.info('Worker listening', {
    environment: config.nodeEnv,
    host: config.host,
    port: config.port,
  });
}

void bootstrap();
