import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type ConditionApplied,
  type ConditionResolved,
} from '../../common/domain-events';

// ── Types ─────────────────────────────────────────────────────────

export const CONDITION_TYPES = ['wound', 'illness', 'exhaustion', 'poisoning'] as const;
export type ConditionType = (typeof CONDITION_TYPES)[number];

export const ILLNESS_SUBTYPES = ['acute', 'chronic'] as const;
export type IllnessSubtype = (typeof ILLNESS_SUBTYPES)[number];

export type LifeStage = 'infant' | 'child' | 'teen' | 'adult' | 'elder';

export interface HealthCondition {
  id: string;
  characterId: string;
  type: ConditionType;
  severity: number; // 1–5
  illnessSubtype?: IllnessSubtype;
  durationDays: number;
  statPenaltyModifier: number;
  recoveryActionRequired: string;
  startedAtDay: number;
  resolvesAtDay: number;
  treatedBySkill: string | null;
}

export interface ConditionPrognosis {
  condition: HealthCondition;
  remainingDays: number;
  isExpired: boolean;
}

export interface ApplyConditionInput {
  characterId: string;
  type: ConditionType;
  severity: number;
  illnessSubtype?: IllnessSubtype;
  currentGameDay: number;
  lifeStage?: LifeStage;
}

// ── Configuration ─────────────────────────────────────────────────

/** Base duration in game-days per severity level. */
const BASE_DURATION_PER_SEVERITY: Record<number, number> = {
  1: 3,
  2: 7,
  3: 14,
  4: 28,
  5: 56,
};

/** Stat penalty modifier per severity level (fraction of stat reduction). */
const STAT_PENALTY_PER_SEVERITY: Record<number, number> = {
  1: 0.05,
  2: 0.10,
  3: 0.20,
  4: 0.35,
  5: 0.50,
};

/** Recovery action required per condition type. */
const RECOVERY_ACTIONS: Record<ConditionType, string> = {
  wound: 'rest_or_surgery',
  illness: 'rest_or_medicine',
  exhaustion: 'sleep',
  poisoning: 'antidote_or_rest',
};

/** Profession skills that provide treatment and their reduction factor. */
const TREATMENT_SKILLS: Record<string, { types: ConditionType[]; reduction: number }> = {
  Surgery: { types: ['wound'], reduction: 0.50 },
  Medicine: { types: ['illness', 'poisoning'], reduction: 0.50 },
  Herbalism: { types: ['illness', 'poisoning', 'exhaustion'], reduction: 0.30 },
  FirstAid: { types: ['wound', 'exhaustion'], reduction: 0.25 },
};

/** Stacking diminishing factor — each additional same-type condition has reduced severity. */
const STACKING_DIMINISH_FACTOR = 0.5;

/** Protected life stages — lethal conditions (severity 5) are blocked. */
const PROTECTED_STAGES: ReadonlySet<LifeStage> = new Set(['infant', 'child']);

/** Chronic illness duration multiplier. */
const CHRONIC_MULTIPLIER = 3;

// ── Service ───────────────────────────────────────────────────────

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  /** In-memory store: characterId → list of active conditions. */
  private readonly store = new Map<string, HealthCondition[]>();

  constructor(private readonly eventBus: DomainEventBus) {}

  // ── Queries ───────────────────────────────────────────────────

  /** Return all active conditions for a character. */
  getConditions(characterId: string): HealthCondition[] {
    return [...(this.store.get(characterId) ?? [])];
  }

  /** Return active conditions with recovery prognosis. */
  getConditionsWithPrognosis(characterId: string, currentGameDay: number): ConditionPrognosis[] {
    const conditions = this.getConditions(characterId);
    return conditions.map((c) => ({
      condition: { ...c },
      remainingDays: Math.max(0, c.resolvesAtDay - currentGameDay),
      isExpired: currentGameDay >= c.resolvesAtDay,
    }));
  }

  /**
   * Compute total stat penalty modifier from all active conditions.
   * Penalties stack additively, capped at 0.80 (never fully zero out stats).
   */
  getTotalStatPenalty(characterId: string): number {
    const conditions = this.getConditions(characterId);
    const total = conditions.reduce((sum, c) => sum + c.statPenaltyModifier, 0);
    return Math.min(total, 0.80);
  }

  // ── Commands ──────────────────────────────────────────────────

  /**
   * Apply a new health condition to a character.
   * Enforces infant/child safety and stacking diminishment.
   * Returns the applied condition, or null if blocked.
   */
  applyCondition(input: ApplyConditionInput): HealthCondition | null {
    const { characterId, type, severity, illnessSubtype, currentGameDay, lifeStage } = input;

    // Enforce infant/child safety: block lethal conditions (severity 5)
    if (!this.checkInfantSafety(severity, lifeStage)) {
      this.logger.warn(
        `Blocked lethal condition type=${type} severity=${severity} for ${characterId} (stage=${lifeStage})`,
        'HealthService',
      );
      return null;
    }

    // Clamp severity to 1–5
    const clampedSeverity = Math.max(1, Math.min(5, severity));

    // Compute effective severity with stacking diminishment
    const existing = this.store.get(characterId) ?? [];
    const sameTypeCount = existing.filter((c) => c.type === type).length;
    const effectiveSeverity = Math.max(
      1,
      Math.round(clampedSeverity * Math.pow(STACKING_DIMINISH_FACTOR, sameTypeCount)),
    );

    // Compute duration
    let durationDays = BASE_DURATION_PER_SEVERITY[effectiveSeverity] ?? 3;
    if (type === 'illness' && illnessSubtype === 'chronic') {
      durationDays *= CHRONIC_MULTIPLIER;
    }

    const condition: HealthCondition = {
      id: generateEventId(),
      characterId,
      type,
      severity: effectiveSeverity,
      illnessSubtype: type === 'illness' ? illnessSubtype : undefined,
      durationDays,
      statPenaltyModifier: STAT_PENALTY_PER_SEVERITY[effectiveSeverity] ?? 0.05,
      recoveryActionRequired: RECOVERY_ACTIONS[type],
      startedAtDay: currentGameDay,
      resolvesAtDay: currentGameDay + durationDays,
      treatedBySkill: null,
    };

    if (!this.store.has(characterId)) {
      this.store.set(characterId, []);
    }
    this.store.get(characterId)!.push(condition);

    // Emit domain event
    const event: ConditionApplied = {
      eventId: generateEventId(),
      type: 'ConditionApplied',
      timestamp: new Date().toISOString(),
      payload: {
        characterId,
        conditionId: condition.id,
        conditionType: condition.type,
        severity: condition.severity,
        durationDays: condition.durationDays,
      },
    };
    this.eventBus.emit(event);

    this.logger.log(
      `Condition applied: character=${characterId} type=${type} severity=${effectiveSeverity} duration=${durationDays}d`,
      'HealthService',
    );

    return condition;
  }

  /**
   * Manually resolve (remove) a specific condition by ID.
   */
  resolveCondition(characterId: string, conditionId: string): boolean {
    const conditions = this.store.get(characterId);
    if (!conditions) return false;

    const index = conditions.findIndex((c) => c.id === conditionId);
    if (index === -1) return false;

    const [removed] = conditions.splice(index, 1);

    const event: ConditionResolved = {
      eventId: generateEventId(),
      type: 'ConditionResolved',
      timestamp: new Date().toISOString(),
      payload: {
        characterId,
        conditionId: removed.id,
        conditionType: removed.type,
        severity: removed.severity,
      },
    };
    this.eventBus.emit(event);

    this.logger.log(
      `Condition resolved: character=${characterId} type=${removed.type} severity=${removed.severity}`,
      'HealthService',
    );

    return true;
  }

  /**
   * Apply a treatment skill to reduce a condition's remaining duration.
   * Returns the new resolves-at day, or null if the skill doesn't apply.
   */
  getTreatmentReduction(
    characterId: string,
    conditionId: string,
    skill: string,
    currentGameDay: number,
  ): number | null {
    const conditions = this.store.get(characterId);
    if (!conditions) return null;

    const condition = conditions.find((c) => c.id === conditionId);
    if (!condition) return null;

    const treatment = TREATMENT_SKILLS[skill];
    if (!treatment || !treatment.types.includes(condition.type)) return null;

    // Already treated
    if (condition.treatedBySkill) return null;

    const remainingDays = condition.resolvesAtDay - currentGameDay;
    if (remainingDays <= 0) return null;

    const reducedDays = Math.max(1, Math.round(remainingDays * (1 - treatment.reduction)));
    condition.resolvesAtDay = currentGameDay + reducedDays;
    condition.durationDays = condition.resolvesAtDay - condition.startedAtDay;
    condition.treatedBySkill = skill;

    this.logger.log(
      `Treatment applied: character=${characterId} condition=${conditionId} skill=${skill} reduction=${treatment.reduction}`,
      'HealthService',
    );

    return condition.resolvesAtDay;
  }

  /**
   * Check infant/child safety: returns true if the condition is allowed,
   * false if it should be blocked (lethal severity for protected stages).
   */
  checkInfantSafety(severity: number, lifeStage?: LifeStage): boolean {
    if (!lifeStage) return true;
    if (PROTECTED_STAGES.has(lifeStage) && severity >= 5) {
      return false;
    }
    return true;
  }

  /**
   * Resolve all expired conditions for all characters.
   * Called each game-day tick. Returns the number of conditions resolved.
   */
  resolveExpiredConditions(currentGameDay: number): number {
    let resolved = 0;

    for (const [characterId, conditions] of this.store) {
      const expired = conditions.filter((c) => currentGameDay >= c.resolvesAtDay);
      for (const condition of expired) {
        this.resolveCondition(characterId, condition.id);
        resolved += 1;
      }
    }

    if (resolved > 0) {
      this.logger.log(
        `Resolved ${resolved} expired conditions on day ${currentGameDay}`,
        'HealthService',
      );
    }

    return resolved;
  }
}
