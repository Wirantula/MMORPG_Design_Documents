import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type NeedsCriticalWarning,
} from '../../common/domain-events';

// ── Types ─────────────────────────────────────────────────────────

export const NEED_DIMENSIONS = ['nutrition', 'fatigue', 'hygiene', 'morale', 'belonging'] as const;
export type NeedDimension = (typeof NEED_DIMENSIONS)[number];

export type NeedStatus = 'critical' | 'low' | 'ok' | 'full';

export interface CharacterNeeds {
  characterId: string;
  nutrition: number;
  fatigue: number;
  hygiene: number;
  morale: number;
  belonging: number;
  updatedAt: string;
}

export interface NeedStatusEntry {
  dimension: NeedDimension;
  value: number;
  status: NeedStatus;
}

// ── Configuration ─────────────────────────────────────────────────

/** Points lost per in-game day for each dimension. */
export const DEFAULT_DECAY_RATES: Record<NeedDimension, number> = {
  nutrition: 15,
  fatigue: 12,
  hygiene: 8,
  morale: 5,
  belonging: 3,
};

const CRITICAL_THRESHOLD = 10;
const LOW_THRESHOLD = 30;
const FULL_THRESHOLD = 100;

// ── Service ───────────────────────────────────────────────────────

@Injectable()
export class NeedsService {
  private readonly logger = new Logger(NeedsService.name);

  /** In-memory store: characterId → needs values. */
  private readonly store = new Map<string, CharacterNeeds>();

  constructor(private readonly eventBus: DomainEventBus) {}

  // ── Queries ───────────────────────────────────────────────────

  /** Return raw need values for a character, initialising if absent. */
  getNeeds(characterId: string): CharacterNeeds {
    let needs = this.store.get(characterId);
    if (!needs) {
      needs = this.initNeeds(characterId);
    }
    return { ...needs };
  }

  /** Return need values with human-readable status labels. */
  getNeedsStatus(characterId: string): NeedStatusEntry[] {
    const needs = this.getNeeds(characterId);
    return NEED_DIMENSIONS.map((dim) => ({
      dimension: dim,
      value: needs[dim],
      status: NeedsService.classifyStatus(needs[dim]),
    }));
  }

  /**
   * Compute a multiplicative modifier based on a character's overall need state.
   * - Average need < CRITICAL_THRESHOLD → 0.70 (−30 %)
   * - Average need === FULL_THRESHOLD   → 1.10 (+10 %)
   * - Otherwise                         → linear interpolation 0.70 → 1.10
   */
  getModifier(characterId: string): number {
    const needs = this.getNeeds(characterId);
    const avg =
      NEED_DIMENSIONS.reduce((sum, dim) => sum + needs[dim], 0) / NEED_DIMENSIONS.length;

    if (avg < CRITICAL_THRESHOLD) return 0.70;
    if (avg >= FULL_THRESHOLD) return 1.10;

    // Linear interpolation between critical (0.70) and full (1.10)
    const t = (avg - CRITICAL_THRESHOLD) / (FULL_THRESHOLD - CRITICAL_THRESHOLD);
    return Math.round((0.70 + t * 0.40) * 100) / 100;
  }

  // ── Commands ──────────────────────────────────────────────────

  /**
   * Apply daily decay to every tracked character's needs.
   * Returns the number of characters processed.
   */
  decayNeeds(gameDay: number): number {
    let processed = 0;
    for (const [characterId, needs] of this.store) {
      for (const dim of NEED_DIMENSIONS) {
        needs[dim] = Math.max(0, needs[dim] - DEFAULT_DECAY_RATES[dim]);
      }
      needs.updatedAt = new Date().toISOString();
      processed += 1;

      // Emit warnings for any dimension that crossed into critical
      this.triggerWarnings(characterId, needs, gameDay);
    }
    this.logger.log(`Decayed needs for ${processed} characters on day ${gameDay}`, 'NeedsService');
    return processed;
  }

  /**
   * Apply a delta to a specific need dimension (e.g. eating restores nutrition).
   * Clamps result to [0, 100].
   */
  adjustNeed(characterId: string, dimension: NeedDimension, delta: number): void {
    const needs = this.getNeeds(characterId);
    const stored = this.store.get(characterId)!;
    stored[dimension] = Math.max(0, Math.min(100, needs[dimension] + delta));
    stored.updatedAt = new Date().toISOString();
  }

  // ── Internals ─────────────────────────────────────────────────

  /** Emit a NeedsCriticalWarning for each dimension below the critical threshold. */
  triggerWarnings(characterId: string, needs: CharacterNeeds, gameDay: number): void {
    for (const dim of NEED_DIMENSIONS) {
      if (needs[dim] < CRITICAL_THRESHOLD) {
        const event: NeedsCriticalWarning = {
          eventId: generateEventId(),
          type: 'NeedsCriticalWarning',
          timestamp: new Date().toISOString(),
          payload: { characterId, dimension: dim, value: needs[dim], gameDay },
        };
        this.eventBus.emit(event);
        this.logger.warn(
          `Critical need: ${dim}=${needs[dim]} for character ${characterId}`,
          'NeedsService',
        );
      }
    }
  }

  private initNeeds(characterId: string): CharacterNeeds {
    const needs: CharacterNeeds = {
      characterId,
      nutrition: 100,
      fatigue: 100,
      hygiene: 100,
      morale: 100,
      belonging: 100,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(characterId, needs);
    return needs;
  }

  // ── Static helpers ────────────────────────────────────────────

  static classifyStatus(value: number): NeedStatus {
    if (value < CRITICAL_THRESHOLD) return 'critical';
    if (value < LOW_THRESHOLD) return 'low';
    if (value >= FULL_THRESHOLD) return 'full';
    return 'ok';
  }
}
