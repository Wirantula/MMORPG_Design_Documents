import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type StatsInitialised,
} from '../../../common/domain-events';
import type {
  CharacterStatRecord,
  CharacterVisibleStatsDto,
  CharacterPotentialDto,
  HiddenPotentialStats,
  VisibleStats,
  WheelOutcomesInput,
} from './stat.types';
import { STAT_FAMILIES, HIDDEN_POTENTIAL_KEYS } from './stat.types';
import {
  STAT_MIN,
  STAT_MAX,
  POTENTIAL_MIN,
  POTENTIAL_MAX,
  RACE_FAMILY_BIAS,
  TRAIT_FAMILY_BIAS,
  ORIGIN_FAMILY_BIAS,
  APTITUDE_POTENTIAL_BIAS,
  ORIGIN_POTENTIAL_BIAS,
  OMEN_POTENTIAL_BIAS,
  type FamilyBias,
  type PotentialBias,
} from './stat.constants';

// ── Deterministic seeded RNG ────────────────────────────────────

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return h;
}

/** Returns a pseudo-random float in [0, 1) from a seed integer. */
function seededRandom(seed: number): number {
  // Simple xorshift-based PRNG
  let s = seed | 0;
  s ^= s << 13;
  s ^= s >> 17;
  s ^= s << 5;
  return Math.abs(s % 10_000) / 10_000;
}

/** Produce a stat value within [min, max] biased around a centre. */
function biasedStatValue(
  baseSeed: number,
  bias: number,
  min: number,
  max: number,
): number {
  const raw = seededRandom(baseSeed);
  const centre = 0.15 + (bias / 100) * 0.35; // bias shifts the centre
  const spread = raw * 0.4 - 0.2; // ±20% noise
  const normalised = Math.max(0, Math.min(1, centre + spread));
  return Math.round(min + normalised * (max - min));
}

@Injectable()
export class StatService {
  private readonly logger = new Logger(StatService.name);

  // In-memory store (placeholder until persistence layer)
  private readonly records = new Map<string, CharacterStatRecord>();

  constructor(private readonly eventBus: DomainEventBus) {}

  // ── Initialisation ──────────────────────────────────────────────

  /**
   * Seed a character's visible stats and hidden potential from wheel outcomes.
   * Called when CharacterBorn event fires.
   */
  initStats(characterId: string, wheels: WheelOutcomesInput): CharacterStatRecord {
    if (this.records.has(characterId)) {
      throw new Error(`Stats already initialised for character ${characterId}`);
    }

    const visible = this.seedVisibleStats(characterId, wheels);
    const potential = this.seedPotentialStats(characterId, wheels);
    const initialisedAt = new Date().toISOString();

    const record: CharacterStatRecord = {
      characterId,
      visible,
      potential,
      initialisedAt,
    };

    this.records.set(characterId, record);

    // Observability: log stat initialisation with family counts
    this.logger.log(
      `Stats initialised: character=${characterId} families=${STAT_FAMILIES.length} potentialKeys=${HIDDEN_POTENTIAL_KEYS.length}`,
      'StatService',
    );

    // Emit domain event
    const event: StatsInitialised = {
      eventId: generateEventId(),
      type: 'StatsInitialised',
      timestamp: initialisedAt,
      payload: {
        characterId,
        statFamilyCount: STAT_FAMILIES.length,
        potentialKeyCount: HIDDEN_POTENTIAL_KEYS.length,
      },
    };
    this.eventBus.emit(event);

    return record;
  }

  // ── Queries ────────────────────────────────────────────────────

  /** Player-facing: returns visible stats only. Hidden layer is NEVER included. */
  getVisibleStats(characterId: string): CharacterVisibleStatsDto | undefined {
    const record = this.records.get(characterId);
    if (!record) return undefined;
    return {
      characterId: record.characterId,
      stats: record.visible,
    };
  }

  /** Admin-only: returns hidden potential layer. */
  getPotentialStats(characterId: string): CharacterPotentialDto | undefined {
    const record = this.records.get(characterId);
    if (!record) return undefined;
    return {
      characterId: record.characterId,
      potential: record.potential,
    };
  }

  /** Server-internal: returns the full record (never expose via player API). */
  getFullRecord(characterId: string): CharacterStatRecord | undefined {
    return this.records.get(characterId);
  }

  // ── Seeding logic ──────────────────────────────────────────────

  private seedVisibleStats(
    characterId: string,
    wheels: WheelOutcomesInput,
  ): VisibleStats {
    // Accumulate biases from race, trait, origin
    const accumulated: FamilyBias = {
      physical: 0,
      mental: 0,
      social: 0,
      perceptual: 0,
      spiritual: 0,
      economic: 0,
    };

    const raceBias = RACE_FAMILY_BIAS[wheels.race] ?? {};
    const traitBias = TRAIT_FAMILY_BIAS[wheels.trait] ?? {};
    const originBias = ORIGIN_FAMILY_BIAS[wheels.origin] ?? {};

    for (const family of STAT_FAMILIES) {
      accumulated[family] +=
        (raceBias[family] ?? 0) +
        (traitBias[family] ?? 0) +
        (originBias[family] ?? 0);
    }

    const statKey = (family: string, stat: string) =>
      hashSeed(`${characterId}:${family}:${stat}`);

    return {
      physical: {
        STR: biasedStatValue(statKey('physical', 'STR'), accumulated.physical, STAT_MIN, STAT_MAX),
        AGI: biasedStatValue(statKey('physical', 'AGI'), accumulated.physical, STAT_MIN, STAT_MAX),
        END: biasedStatValue(statKey('physical', 'END'), accumulated.physical, STAT_MIN, STAT_MAX),
        REC: biasedStatValue(statKey('physical', 'REC'), accumulated.physical, STAT_MIN, STAT_MAX),
      },
      mental: {
        INT: biasedStatValue(statKey('mental', 'INT'), accumulated.mental, STAT_MIN, STAT_MAX),
        FOC: biasedStatValue(statKey('mental', 'FOC'), accumulated.mental, STAT_MIN, STAT_MAX),
        CRE: biasedStatValue(statKey('mental', 'CRE'), accumulated.mental, STAT_MIN, STAT_MAX),
        MEM: biasedStatValue(statKey('mental', 'MEM'), accumulated.mental, STAT_MIN, STAT_MAX),
      },
      social: {
        CHA: biasedStatValue(statKey('social', 'CHA'), accumulated.social, STAT_MIN, STAT_MAX),
        AUT: biasedStatValue(statKey('social', 'AUT'), accumulated.social, STAT_MIN, STAT_MAX),
        EMP: biasedStatValue(statKey('social', 'EMP'), accumulated.social, STAT_MIN, STAT_MAX),
        DEC: biasedStatValue(statKey('social', 'DEC'), accumulated.social, STAT_MIN, STAT_MAX),
      },
      perceptual: {
        AWR: biasedStatValue(statKey('perceptual', 'AWR'), accumulated.perceptual, STAT_MIN, STAT_MAX),
        PRE: biasedStatValue(statKey('perceptual', 'PRE'), accumulated.perceptual, STAT_MIN, STAT_MAX),
        INS: biasedStatValue(statKey('perceptual', 'INS'), accumulated.perceptual, STAT_MIN, STAT_MAX),
      },
      spiritual: {
        WIL: biasedStatValue(statKey('spiritual', 'WIL'), accumulated.spiritual, STAT_MIN, STAT_MAX),
        RES: biasedStatValue(statKey('spiritual', 'RES'), accumulated.spiritual, STAT_MIN, STAT_MAX),
        AET: biasedStatValue(statKey('spiritual', 'AET'), accumulated.spiritual, STAT_MIN, STAT_MAX),
      },
      economic: {
        APR: biasedStatValue(statKey('economic', 'APR'), accumulated.economic, STAT_MIN, STAT_MAX),
        NEG: biasedStatValue(statKey('economic', 'NEG'), accumulated.economic, STAT_MIN, STAT_MAX),
        LOG: biasedStatValue(statKey('economic', 'LOG'), accumulated.economic, STAT_MIN, STAT_MAX),
      },
    };
  }

  private seedPotentialStats(
    characterId: string,
    wheels: WheelOutcomesInput,
  ): HiddenPotentialStats {
    const accumulated: PotentialBias = {
      growth_elasticity: 0,
      ceiling_bias: 0,
      fortune_bias: 0,
      craft_intuition: 0,
      combat_instinct: 0,
      research_spark: 0,
      trauma_susceptibility: 0,
    };

    const aptBias = APTITUDE_POTENTIAL_BIAS[wheels.aptitude] ?? {};
    const originBias = ORIGIN_POTENTIAL_BIAS[wheels.origin] ?? {};
    const omenBias = wheels.omen ? (OMEN_POTENTIAL_BIAS[wheels.omen] ?? {}) : {};

    for (const key of HIDDEN_POTENTIAL_KEYS) {
      accumulated[key] +=
        (aptBias[key] ?? 0) +
        (originBias[key] ?? 0) +
        (omenBias[key] ?? 0);
    }

    const potKey = (k: string) => hashSeed(`${characterId}:potential:${k}`);

    const result: Record<string, number> = {};
    for (const key of HIDDEN_POTENTIAL_KEYS) {
      result[key] = biasedStatValue(
        potKey(key),
        accumulated[key],
        POTENTIAL_MIN,
        POTENTIAL_MAX,
      );
    }

    return result as unknown as HiddenPotentialStats;
  }
}
