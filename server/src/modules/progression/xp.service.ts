import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type SkillLevelUp,
} from '../../common/domain-events';
import type { StatFamily } from '../characters/stats/stat.types';
import type { HiddenPotentialStats } from '../characters/stats/stat.types';
import {
  xpRequired,
  isSoftCapped,
  SOFT_CAP_EFFICIENCY,
  DECAY_INACTIVITY_THRESHOLD_DAYS,
  DECAY_RATE_PER_DAY,
  DECAY_ELIGIBLE_FAMILIES,
  DOMAIN_MULTIPLIERS,
  XP_BASE,
  XP_EXPONENT,
  PEAK_HUMAN_LEVEL,
  SUPERHUMAN_MAX_LEVEL,
  SUPERHUMAN_EXTRA_EXPONENT,
} from './curves';

// ── Internal XP tracking ────────────────────────────────────────

export interface SkillXpRecord {
  level: number;
  currentXp: number;
  /** In-game day of last XP gain for this skill. */
  lastActivityDay: number;
}

export interface XpAwardResult {
  previousLevel: number;
  newLevel: number;
  xpApplied: number;
  softCapped: boolean;
  levelledUp: boolean;
}

export interface DecayResult {
  skill: string;
  previousLevel: number;
  newLevel: number;
  daysInactive: number;
}

export interface CurveDataPoint {
  level: number;
  xpRequired: number;
}

export interface CurveDataResponse {
  families: Record<string, CurveDataPoint[]>;
  constants: {
    base: number;
    exponent: number;
    peakHumanLevel: number;
    superhumanMaxLevel: number;
    superhumanExtraExponent: number;
    softCapEfficiency: number;
    decayRatePerDay: number;
    decayInactivityThresholdDays: number;
  };
}

// ── Service ─────────────────────────────────────────────────────

@Injectable()
export class XpService {
  private readonly logger = new Logger(XpService.name);

  /**
   * In-memory store: characterId → skillKey → SkillXpRecord.
   * A real persistence layer will replace this later.
   */
  private readonly store = new Map<string, Map<string, SkillXpRecord>>();

  constructor(private readonly eventBus: DomainEventBus) {}

  // ── Commands ──────────────────────────────────────────────────

  /**
   * Award raw XP to a character's skill, applying hidden-potential
   * modifiers and soft cap. Emits SkillLevelUp if a level boundary
   * is crossed.
   */
  awardXp(
    characterId: string,
    skill: string,
    family: StatFamily,
    rawXp: number,
    potential: HiddenPotentialStats,
    currentGameDay: number,
  ): XpAwardResult {
    const record = this.getOrCreate(characterId, skill);
    const previousLevel = record.level;

    const effectiveXp = this.computeEffectiveGain(
      rawXp,
      record.level,
      family,
      potential,
    );

    record.currentXp += effectiveXp;
    record.lastActivityDay = currentGameDay;

    // Level up: consume XP thresholds until we can't advance
    let levelledUp = false;
    while (record.level < SUPERHUMAN_MAX_LEVEL) {
      const needed = xpRequired(record.level, family);
      if (record.currentXp < needed) break;
      record.currentXp -= needed;
      record.level += 1;
      levelledUp = true;

      // Emit domain event for each level gained
      const event: SkillLevelUp = {
        eventId: generateEventId(),
        type: 'SkillLevelUp',
        timestamp: new Date().toISOString(),
        payload: {
          characterId,
          skill,
          newLevel: record.level,
        },
      };
      this.eventBus.emit(event);
      this.logger.log(
        `SkillLevelUp: ${characterId} ${skill} → ${record.level}`,
      );
    }

    const softCapped = isSoftCapped(record.level, potential.ceiling_bias);

    return {
      previousLevel,
      newLevel: record.level,
      xpApplied: effectiveXp,
      softCapped,
      levelledUp,
    };
  }

  /**
   * Apply time-based decay to physically-maintained skills for a
   * character. Should be called once per tick/day cycle.
   */
  applyDecay(characterId: string, currentGameDay: number): DecayResult[] {
    const skills = this.store.get(characterId);
    if (!skills) return [];

    const results: DecayResult[] = [];

    for (const [skill, record] of skills) {
      // Only decay-eligible families
      if (!DECAY_ELIGIBLE_FAMILIES.some((f) => skill.startsWith(f))) continue;

      const daysInactive = currentGameDay - record.lastActivityDay;
      if (daysInactive <= DECAY_INACTIVITY_THRESHOLD_DAYS) continue;

      const previousLevel = record.level;
      const decayDays = daysInactive - DECAY_INACTIVITY_THRESHOLD_DAYS;
      const factor = Math.pow(1 - DECAY_RATE_PER_DAY, decayDays);
      const newLevel = Math.max(1, Math.floor(record.level * factor));

      if (newLevel < record.level) {
        record.level = newLevel;
        record.currentXp = 0; // Reset partial XP on decay
        this.logger.log(
          `Decay: ${characterId} ${skill} ${previousLevel} → ${newLevel} (${decayDays}d past threshold)`,
        );
        results.push({ skill, previousLevel, newLevel, daysInactive });
      }
    }

    return results;
  }

  /**
   * Compute effective XP gain after applying growth_elasticity and
   * soft-cap modifiers.
   */
  computeEffectiveGain(
    rawXp: number,
    currentLevel: number,
    family: StatFamily,
    potential: HiddenPotentialStats,
  ): number {
    let xp = rawXp * potential.growth_elasticity;

    // Apply domain-specific resistance (already in xpRequired, but
    // also reduce raw gain slightly for harder domains)
    const domainResistance = DOMAIN_MULTIPLIERS[family] ?? 1.0;
    xp /= domainResistance;

    // Soft cap: if past ceiling_bias threshold, drastically reduce gain
    if (isSoftCapped(currentLevel, potential.ceiling_bias)) {
      xp *= SOFT_CAP_EFFICIENCY;
    }

    return Math.max(0, Math.round(xp));
  }

  // ── Queries ───────────────────────────────────────────────────

  getSkillRecord(
    characterId: string,
    skill: string,
  ): SkillXpRecord | undefined {
    return this.store.get(characterId)?.get(skill);
  }

  /**
   * Return curve data for the admin balancing endpoint.
   * Samples XP requirements at every 10th level for each family.
   */
  getCurveData(): CurveDataResponse {
    const families: Record<string, CurveDataPoint[]> = {};

    for (const family of Object.keys(DOMAIN_MULTIPLIERS) as StatFamily[]) {
      const points: CurveDataPoint[] = [];
      for (let lvl = 1; lvl < SUPERHUMAN_MAX_LEVEL; lvl += 10) {
        points.push({ level: lvl, xpRequired: xpRequired(lvl, family) });
      }
      families[family] = points;
    }

    return {
      families,
      constants: {
        base: XP_BASE,
        exponent: XP_EXPONENT,
        peakHumanLevel: PEAK_HUMAN_LEVEL,
        superhumanMaxLevel: SUPERHUMAN_MAX_LEVEL,
        superhumanExtraExponent: SUPERHUMAN_EXTRA_EXPONENT,
        softCapEfficiency: SOFT_CAP_EFFICIENCY,
        decayRatePerDay: DECAY_RATE_PER_DAY,
        decayInactivityThresholdDays: DECAY_INACTIVITY_THRESHOLD_DAYS,
      },
    };
  }

  // ── Internals ─────────────────────────────────────────────────

  private getOrCreate(characterId: string, skill: string): SkillXpRecord {
    if (!this.store.has(characterId)) {
      this.store.set(characterId, new Map());
    }
    const skills = this.store.get(characterId)!;
    if (!skills.has(skill)) {
      skills.set(skill, { level: 1, currentXp: 0, lastActivityDay: 0 });
    }
    return skills.get(skill)!;
  }
}
