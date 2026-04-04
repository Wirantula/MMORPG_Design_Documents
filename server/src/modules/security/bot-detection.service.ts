import { Injectable, Logger } from '@nestjs/common';

/**
 * Tracks identical actions per character within a rolling 1-second window.
 * If a character submits > 5 identical actions in 1 s the request is flagged
 * and a structured log entry is emitted.
 *
 * Production intent: back this with a Redis sorted set (ZADD + ZRANGEBYSCORE).
 * For now we use an in-memory Map so the module has zero external dependencies.
 */
@Injectable()
export class BotDetectionService {
  private readonly logger = new Logger(BotDetectionService.name);

  /** characterId -> array of { actionKey, timestampMs } */
  private readonly actionLog = new Map<string, { actionKey: string; ts: number }[]>();

  /** Threshold: identical actions within the rolling window */
  static readonly THRESHOLD = 5;
  /** Rolling window size in milliseconds */
  static readonly WINDOW_MS = 1_000;

  /**
   * Record an action and return `true` if bot-like behaviour is detected.
   */
  check(characterId: string, actionKey: string): boolean {
    const now = Date.now();
    const cutoff = now - BotDetectionService.WINDOW_MS;

    // Get or create entry
    let entries = this.actionLog.get(characterId);
    if (!entries) {
      entries = [];
      this.actionLog.set(characterId, entries);
    }

    // Prune expired entries
    entries = entries.filter((e) => e.ts > cutoff);
    this.actionLog.set(characterId, entries);

    // Push current action
    entries.push({ actionKey, ts: now });

    // Count identical actions within the window
    const identicalCount = entries.filter((e) => e.actionKey === actionKey).length;

    if (identicalCount > BotDetectionService.THRESHOLD) {
      this.logger.warn(
        JSON.stringify({
          event: 'bot_flag',
          characterId,
          actionKey,
          identicalCount,
          windowMs: BotDetectionService.WINDOW_MS,
        }),
        'BotDetection',
      );
      return true;
    }

    return false;
  }

  /** Visible for testing — clear all tracked state. */
  reset(): void {
    this.actionLog.clear();
  }
}
