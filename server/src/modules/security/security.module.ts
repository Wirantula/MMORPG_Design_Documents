import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BotDetectionService } from './bot-detection.service';
import { XssSanitizeInterceptor } from './xss-sanitize.interceptor';

/**
 * SecurityModule provides rate limiting (via @nestjs/throttler), bot-detection
 * and XSS sanitisation for the entire application.
 *
 * NOTE: DO NOT add DomainEventBus or AppLogger to `providers` here.
 * They are global singletons owned by SharedModule.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        // Default rate limit: 60 requests per 60 seconds (1 req/s avg).
        // Individual controllers can override with @Throttle().
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
    ]),
  ],
  providers: [
    BotDetectionService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: XssSanitizeInterceptor,
    },
  ],
  exports: [BotDetectionService],
})
export class SecurityModule {}
