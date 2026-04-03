import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type TraitsRolled,
} from '../../../common/domain-events';
import type { WheelOutcomesInput } from '../stats/stat.types';
import {
  PASSIVE_TRAIT_NAMES,
  TRAIT_WEIGHT_MIN,
  TRAIT_WEIGHT_MAX,
  WHEEL_TRAIT_BIAS,
  WHEEL_OMEN_BIAS,
  HINT_TABLE,
  classifyWeight,
  type PassiveTraitName,
  type PassiveTraitEntry,
  type CharacterPassiveTraits,
  type TraitHintDto,
  type WeightBucket,
} from './trait.types';

// ── Deterministic seeded RNG (same util used in stat.service) ───

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return h;
}

/** Returns a pseudo-random float in [0, 1) from a seed integer. */
function seededRandom(seed: number): number {
  let s = seed | 0;
  s ^= s << 13;
  s ^= s >> 17;
  s ^= s << 5;
  return Math.abs(s % 10_000) / 10_000;
}

/** Produce a weight value within [min, max] biased around a centre. */
function biasedWeight(
  baseSeed: number,
  bias: number,
  min: number,
  max: number,
): number {
  const raw = seededRandom(baseSeed);
  // bias shifts the centre of the distribution; 0 bias → 0.5 centre
  const centre = 0.5 + (bias / 200);
  const spread = raw * 0.4 - 0.2; // ±20% noise
  const normalised = Math.max(0, Math.min(1, centre + spread));
  return Math.round(min + normalised * (max - min));
}

@Injectable()
export class TraitService {
  private readonly logger = new Logger(TraitService.name);

  // In-memory store (placeholder until persistence layer)
  private readonly store = new Map<string, CharacterPassiveTraits>();

  constructor(private readonly eventBus: DomainEventBus) {}

  // ── Roll traits from wheel outcomes ────────────────────────────

  /**
   * Seed passive hidden traits for a character from wheel outcomes.
   * Called when CharacterBorn event fires.
   * Traits are rolled from wheel results and stored server-only.
   */
  rollTraits(characterId: string, wheels: WheelOutcomesInput): CharacterPassiveTraits {
    if (this.store.has(characterId)) {
      throw new Error(`Traits already rolled for character ${characterId}`);
    }

    const traitBias = WHEEL_TRAIT_BIAS[wheels.trait] ?? {};
    const omenBias = wheels.omen ? (WHEEL_OMEN_BIAS[wheels.omen] ?? {}) : {};

    const traits: PassiveTraitEntry[] = PASSIVE_TRAIT_NAMES.map((traitName) => {
      const accBias = (traitBias[traitName] ?? 0) + (omenBias[traitName] ?? 0);
      const seed = hashSeed(`${characterId}:trait:${traitName}`);
      const weight = biasedWeight(seed, accBias, TRAIT_WEIGHT_MIN, TRAIT_WEIGHT_MAX);
      return { traitName, weight };
    });

    const rolledAt = new Date().toISOString();
    const record: CharacterPassiveTraits = { characterId, traits, rolledAt };
    this.store.set(characterId, record);

    // Observability: log trait names and weight buckets (not exact values)
    const bucketLog = traits
      .map((t) => `${t.traitName}=${classifyWeight(t.weight)}`)
      .join(', ');
    this.logger.log(
      `Traits rolled: character=${characterId} [${bucketLog}]`,
      'TraitService',
    );

    // Emit domain event
    const event: TraitsRolled = {
      eventId: generateEventId(),
      type: 'TraitsRolled',
      timestamp: rolledAt,
      payload: {
        characterId,
        traitBuckets: Object.fromEntries(
          traits.map((t) => [t.traitName, classifyWeight(t.weight)]),
        ) as Record<PassiveTraitName, WeightBucket>,
      },
    };
    this.eventBus.emit(event);

    return record;
  }

  // ── Probability bias for action resolution ────────────────────

  /**
   * Apply trait weight as a probability multiplier.
   * Returns a multiplier in [0.5, 1.5] range.
   * Stub hook for story 4.2 action resolver extension.
   *
   * @param characterId - the character to look up
   * @param traitName   - which passive trait applies
   * @param baseProbability - the base probability (0..1) before bias
   * @returns biased probability clamped to [0, 1]
   */
  applyTraitBias(
    characterId: string,
    traitName: PassiveTraitName,
    baseProbability: number,
  ): number {
    const record = this.store.get(characterId);
    if (!record) return baseProbability;

    const entry = record.traits.find((t) => t.traitName === traitName);
    if (!entry) return baseProbability;

    // Map weight (-100..+100) to multiplier (0.5..1.5)
    const multiplier = 1.0 + (entry.weight / 200);
    const biased = baseProbability * multiplier;
    return Math.max(0, Math.min(1, biased));
  }

  // ── Hint generation (player-facing) ───────────────────────────

  /**
   * Generate narrative hints for a character's passive traits.
   * Returns only flavour text — raw weights are never exposed.
   */
  generateHints(characterId: string): TraitHintDto | undefined {
    const record = this.store.get(characterId);
    if (!record) return undefined;

    const hints = record.traits
      .filter((t) => classifyWeight(t.weight) !== 'neutral')
      .map((t) => HINT_TABLE[t.traitName][classifyWeight(t.weight)]);

    return { characterId, hints };
  }

  // ── Server-internal queries ───────────────────────────────────

  /** Server-internal: returns the full trait record. Never expose via player API. */
  getTraits(characterId: string): CharacterPassiveTraits | undefined {
    return this.store.get(characterId);
  }
}
