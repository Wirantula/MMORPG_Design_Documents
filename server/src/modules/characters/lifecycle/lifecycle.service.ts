import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type LifeStageTransition,
} from '../../../common/domain-events';

// ── Life-stage definitions ────────────────────────────────────────

export const LIFE_STAGES = ['infant', 'child', 'teen', 'adult', 'elder'] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export interface LifeStageRange {
  stage: LifeStage;
  minAge: number;
  maxAge: number;
}

export const STAGE_RANGES: readonly LifeStageRange[] = [
  { stage: 'infant', minAge: 0, maxAge: 2 },
  { stage: 'child', minAge: 3, maxAge: 9 },
  { stage: 'teen', minAge: 10, maxAge: 14 },
  { stage: 'adult', minAge: 15, maxAge: 45 },
  { stage: 'elder', minAge: 46, maxAge: Infinity },
] as const;

/** Actions blocked for protected life stages. */
const DANGEROUS_ACTIONS = new Set([
  'combat',
  'trade',
  'travel_wilderness',
  'dungeon',
  'pvp',
  'contract_sign',
]);

const PROTECTED_STAGES: ReadonlySet<LifeStage> = new Set(['infant', 'child']);

// ── In-game year constant ─────────────────────────────────────────

/** One in-game year expressed in game-days (365 days per year). */
const GAME_DAYS_PER_YEAR = 365;

// ── Character record (minimal subset needed by lifecycle) ─────────

export interface CharacterRecord {
  characterId: string;
  bornAtGameDay: number;
  currentStage: LifeStage;
}

// ── Service ───────────────────────────────────────────────────────

@Injectable()
export class LifecycleService {
  private readonly logger = new Logger(LifecycleService.name);

  /** In-memory character registry – production will read from DB. */
  private readonly characters = new Map<string, CharacterRecord>();

  constructor(private readonly eventBus: DomainEventBus) {}

  // ── Registration ──────────────────────────────────────────────

  registerCharacter(characterId: string, bornAtGameDay: number): CharacterRecord {
    const record: CharacterRecord = {
      characterId,
      bornAtGameDay,
      currentStage: 'infant',
    };
    this.characters.set(characterId, record);
    return record;
  }

  getCharacter(characterId: string): CharacterRecord | undefined {
    return this.characters.get(characterId);
  }

  // ── Pure computation ──────────────────────────────────────────

  /**
   * Derive the life stage from age in game-years.
   */
  computeLifeStage(ageInGameYears: number): LifeStage {
    for (const range of STAGE_RANGES) {
      if (ageInGameYears >= range.minAge && ageInGameYears <= range.maxAge) {
        return range.stage;
      }
    }
    return 'elder'; // fallback for very high ages
  }

  /**
   * Convert game-day delta to game-years.
   */
  gameDaysToYears(gameDays: number): number {
    return Math.floor(gameDays / GAME_DAYS_PER_YEAR);
  }

  // ── Restriction enforcement ───────────────────────────────────

  /**
   * Returns true if the given action is blocked for the character's
   * current life stage.
   */
  enforceStageRestrictions(characterId: string, actionId: string): boolean {
    const record = this.characters.get(characterId);
    if (!record) return false;

    if (PROTECTED_STAGES.has(record.currentStage) && DANGEROUS_ACTIONS.has(actionId)) {
      this.logger.warn(
        `Blocked action "${actionId}" for ${characterId} (stage=${record.currentStage})`,
        'LifecycleService',
      );
      return true; // action is blocked
    }
    return false;
  }

  /**
   * Returns the set of action IDs that are dangerous (blocked for
   * protected stages).
   */
  getDangerousActions(): ReadonlySet<string> {
    return DANGEROUS_ACTIONS;
  }

  /**
   * Returns the set of stages considered protected.
   */
  getProtectedStages(): ReadonlySet<LifeStage> {
    return PROTECTED_STAGES;
  }

  // ── Tick processing ───────────────────────────────────────────

  /**
   * Evaluate every registered character for stage transitions.
   * Called once per game-day from the tick loop.
   *
   * Returns the list of characters whose stage changed.
   */
  processCharacterLifecycles(currentGameDay: number): LifeStageTransition[] {
    const transitions: LifeStageTransition[] = [];

    for (const record of this.characters.values()) {
      const ageDays = currentGameDay - record.bornAtGameDay;
      const ageYears = this.gameDaysToYears(ageDays);
      const newStage = this.computeLifeStage(ageYears);

      if (newStage !== record.currentStage) {
        const previousStage = record.currentStage;
        record.currentStage = newStage;

        const event: LifeStageTransition = {
          eventId: generateEventId(),
          type: 'LifeStageTransition',
          timestamp: new Date().toISOString(),
          payload: {
            characterId: record.characterId,
            previousStage,
            newStage,
            ageInGameYears: ageYears,
            gameDay: currentGameDay,
          },
        };

        this.eventBus.emit(event);
        this.logger.log(
          `LifeStageTransition character=${record.characterId} ` +
            `${previousStage} → ${newStage} (age=${ageYears})`,
          'LifecycleService',
        );

        transitions.push(event);
      }
    }

    return transitions;
  }
}
