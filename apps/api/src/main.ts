import 'reflect-metadata';

import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { logger } from '@vibeshub/observability';

import { AppModule } from './app.module.js';
import { parseApiConfig } from './config.js';

async function bootstrap(): Promise<void> {
  const config = parseApiConfig(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );

  app.enableCors({ credentials: true, origin: config.corsOrigins });
  app.setGlobalPrefix('v1', {
    exclude: [
      { method: RequestMethod.GET, path: 'health' },
      { method: RequestMethod.GET, path: 'health/ready' },
      { method: RequestMethod.GET, path: 'go/:publicId' },
    ],
  });
  app.enableShutdownHooks();

  await app.listen(config.port, config.host);
  logger.info('API listening', {
    environment: config.nodeEnv,
    host: config.host,
    port: config.port,
  });
}

void bootstrap();
