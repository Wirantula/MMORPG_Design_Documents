/**
 * worker.ts — Standalone worker entrypoint.
 *
 * Boots the NestJS application context (no HTTP listener) so that:
 *  • TickService starts the simulation tick loop
 *  • AI proposal jobs can run in the background
 *
 * Run via: node dist/worker.js
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger.service';

async function bootstrap(): Promise<void> {
  // Application context only — no HTTP server is started.
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  logger.log('Worker process started (tick scheduler + AI proposal jobs)', 'Worker');

  // Graceful shutdown on SIGTERM / SIGINT (Docker stop).
  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Received ${signal}, shutting down worker…`, 'Worker');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Worker failed to start:', error);
  process.exit(1);
});
