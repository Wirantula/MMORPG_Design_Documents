import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { AppLogger } from './common/logger.service';
import { OpsService } from './modules/ops/ops.service';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLogger);
  app.useLogger(logger);
  app.setGlobalPrefix('api');

  // ── Migration pre-flight check ─────────────────────────────────
  const opsService = app.get(OpsService);
  const migrationResult = opsService.checkMigrations();
  if (!migrationResult.ok) {
    logger.error(
      `Migration check FAILED: applied=${migrationResult.applied} expected=${migrationResult.expected} missing=[${migrationResult.missing.join(', ')}]`,
      undefined,
      'Bootstrap',
    );
    process.exit(1);
  }
  logger.log('Migration check passed', 'Bootstrap');

  // ── Security hardening ────────────────────────────────────────
  // CSRF: enforce SameSite=Strict on all cookies.
  // Additional security headers (X-Content-Type-Options, etc.).
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Set-Cookie', 'Path=/; HttpOnly; SameSite=Strict');
    next();
  });

  await app.listen(env.serverPort);
  logger.log(`Server listening on ${env.serverPort}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
