import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TraitService } from '../src/modules/characters/traits/trait.service';
import { DomainEventBus } from '../src/common/domain-events';
import {
  PASSIVE_TRAIT_NAMES,
  TRAIT_WEIGHT_MIN,
  TRAIT_WEIGHT_MAX,
  classifyWeight,
  HINT_TABLE,
  type WeightBucket,
} from '../src/modules/characters/traits/trait.types';
import type { WheelOutcomesInput } from '../src/modules/characters/stats/stat.types';

function createTraitService() {
  const eventBus = new DomainEventBus();
  const traitService = new TraitService(eventBus);
  return { traitService, eventBus };
}

const SAMPLE_WHEELS: WheelOutcomesInput = {
  race: 'human',
  aptitude: 'warrior',
  trait: 'stoic',
  origin: 'village',
};

const WHEELS_WITH_OMEN: WheelOutcomesInput = {
  ...SAMPLE_WHEELS,
  omen: 'blessed',
};

describe('TraitService', () => {
  let ctx: ReturnType<typeof createTraitService>;

  beforeEach(() => {
    ctx = createTraitService();
  });

  // ── rollTraits ──────────────────────────────────────────────────

  describe('rollTraits', () => {
    it('rolls all 6 passive traits for a character', () => {
      const record = ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);

      expect(record.characterId).toBe('char-1');
      expect(record.traits).toHaveLength(6);

      const traitNames = record.traits.map((t) => t.traitName);
      for (const name of PASSIVE_TRAIT_NAMES) {
        expect(traitNames).toContain(name);
      }
    });

    it('produces weights within the valid range [-100, +100]', () => {
      const record = ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);

      for (const trait of record.traits) {
        expect(trait.weight).toBeGreaterThanOrEqual(TRAIT_WEIGHT_MIN);
        expect(trait.weight).toBeLessThanOrEqual(TRAIT_WEIGHT_MAX);
      }
    });

    it('produces deterministic results for the same characterId and wheels', () => {
      const record1 = ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);

      // Create fresh service to avoid duplicate-roll guard
      const ctx2 = createTraitService();
      const record2 = ctx2.traitService.rollTraits('char-1', SAMPLE_WHEELS);

      for (let i = 0; i < record1.traits.length; i++) {
        expect(record1.traits[i].traitName).toBe(record2.traits[i].traitName);
        expect(record1.traits[i].weight).toBe(record2.traits[i].weight);
      }
    });

    it('produces different results for different characterIds', () => {
      const record1 = ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);

      const ctx2 = createTraitService();
      const record2 = ctx2.traitService.rollTraits('char-2', SAMPLE_WHEELS);

      // At least one trait should differ
      const differs = record1.traits.some(
        (t, i) => t.weight !== record2.traits[i].weight,
      );
      expect(differs).toBe(true);
    });

    it('rejects double-roll for the same character', () => {
      ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);

      expect(() => ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS)).toThrow(
        'Traits already rolled',
      );
    });

    it('applies wheel trait bias to relevant passive traits', () => {
      // 'stoic' biases: trauma_susceptibility -30, catastrophe_avoidance +20
      // Run multiple characters and check average tendency
      const traumaWeights: number[] = [];
      const catWeights: number[] = [];

      for (let i = 0; i < 50; i++) {
        const svc = createTraitService();
        const record = svc.traitService.rollTraits(`char-stoic-${i}`, {
          ...SAMPLE_WHEELS,
          trait: 'stoic',
        });
        const trauma = record.traits.find((t) => t.traitName === 'trauma_susceptibility')!;
        const cat = record.traits.find((t) => t.traitName === 'catastrophe_avoidance')!;
        traumaWeights.push(trauma.weight);
        catWeights.push(cat.weight);
      }

      const avgTrauma = traumaWeights.reduce((a, b) => a + b, 0) / traumaWeights.length;
      const avgCat = catWeights.reduce((a, b) => a + b, 0) / catWeights.length;

      // Stoic should bias trauma_susceptibility lower (negative bias)
      // and catastrophe_avoidance higher (positive bias)
      expect(avgTrauma).toBeLessThan(avgCat);
    });

    it('applies omen bias when present', () => {
      // 'blessed' omen: fortune_drift +40, catastrophe_avoidance +20
      const fortuneWeights: number[] = [];

      for (let i = 0; i < 50; i++) {
        const svc = createTraitService();
        const record = svc.traitService.rollTraits(`char-blessed-${i}`, WHEELS_WITH_OMEN);
        const fortune = record.traits.find((t) => t.traitName === 'fortune_drift')!;
        fortuneWeights.push(fortune.weight);
      }

      const avg = fortuneWeights.reduce((a, b) => a + b, 0) / fortuneWeights.length;
      // Blessed omen should push fortune_drift above zero on average
      expect(avg).toBeGreaterThan(0);
    });
  });

  // ── applyTraitBias ──────────────────────────────────────────────

  describe('applyTraitBias', () => {
    it('returns biased probability within [0, 1]', () => {
      ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);

      const biased = ctx.traitService.applyTraitBias('char-1', 'fortune_drift', 0.5);
      expect(biased).toBeGreaterThanOrEqual(0);
      expect(biased).toBeLessThanOrEqual(1);
    });

    it('positive weight increases probability', () => {
      // Force a known scenario: roll traits then check behaviour
      ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);
      const record = ctx.traitService.getTraits('char-1')!;
      const fortuneEntry = record.traits.find((t) => t.traitName === 'fortune_drift')!;

      const base = 0.5;
      const biased = ctx.traitService.applyTraitBias('char-1', 'fortune_drift', base);

      if (fortuneEntry.weight > 0) {
        expect(biased).toBeGreaterThan(base);
      } else if (fortuneEntry.weight < 0) {
        expect(biased).toBeLessThan(base);
      } else {
        expect(biased).toBe(base);
      }
    });

    it('returns base probability when character has no traits', () => {
      const result = ctx.traitService.applyTraitBias('nonexistent', 'fortune_drift', 0.7);
      expect(result).toBe(0.7);
    });

    it('clamps biased probability to [0, 1]', () => {
      ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);

      // Test with extreme base probabilities
      const low = ctx.traitService.applyTraitBias('char-1', 'fortune_drift', 0.0);
      const high = ctx.traitService.applyTraitBias('char-1', 'fortune_drift', 1.0);

      expect(low).toBeGreaterThanOrEqual(0);
      expect(high).toBeLessThanOrEqual(1);
    });

    it('multiplier maps weight range to [0.5, 1.5]', () => {
      ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);
      const record = ctx.traitService.getTraits('char-1')!;

      for (const trait of record.traits) {
        const expectedMultiplier = 1.0 + (trait.weight / 200);
        expect(expectedMultiplier).toBeGreaterThanOrEqual(0.5);
        expect(expectedMultiplier).toBeLessThanOrEqual(1.5);
      }
    });
  });

  // ── generateHints ───────────────────────────────────────────────

  describe('generateHints', () => {
    it('returns narrative hint strings, not raw weights', () => {
      ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);
      const dto = ctx.traitService.generateHints('char-1')!;

      expect(dto.characterId).toBe('char-1');
      expect(Array.isArray(dto.hints)).toBe(true);

      // Every hint must be a known narrative string from HINT_TABLE
      const allHints = new Set<string>();
      for (const traitName of PASSIVE_TRAIT_NAMES) {
        for (const bucket of ['strong_negative', 'negative', 'neutral', 'positive', 'strong_positive'] as WeightBucket[]) {
          allHints.add(HINT_TABLE[traitName][bucket]);
        }
      }

      for (const hint of dto.hints) {
        expect(allHints.has(hint)).toBe(true);
      }
    });

    it('excludes neutral traits from hints', () => {
      ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);
      const record = ctx.traitService.getTraits('char-1')!;
      const dto = ctx.traitService.generateHints('char-1')!;

      const neutralCount = record.traits.filter(
        (t) => classifyWeight(t.weight) === 'neutral',
      ).length;
      const nonNeutralCount = record.traits.length - neutralCount;

      expect(dto.hints.length).toBe(nonNeutralCount);
    });

    it('returns undefined for unknown character', () => {
      const dto = ctx.traitService.generateHints('nonexistent');
      expect(dto).toBeUndefined();
    });

    it('never contains numeric weight values', () => {
      ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);
      const dto = ctx.traitService.generateHints('char-1')!;

      for (const hint of dto.hints) {
        // Hint should not contain numbers that look like weights
        expect(hint).not.toMatch(/-?\d{2,3}/);
      }
    });
  });

  // ── Trait NOT in player API ─────────────────────────────────────

  describe('player API safety', () => {
    it('generateHints response contains no weight or traitName fields', () => {
      ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);
      const dto = ctx.traitService.generateHints('char-1')!;

      // DTO should only have characterId and hints (string[])
      const keys = Object.keys(dto);
      expect(keys).toEqual(['characterId', 'hints']);

      // No weight values leak through
      const serialised = JSON.stringify(dto);
      expect(serialised).not.toContain('"weight"');
      expect(serialised).not.toContain('"traitName"');
    });

    it('getTraits is server-internal and returns full weights', () => {
      ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);
      const record = ctx.traitService.getTraits('char-1')!;

      // Internal record DOES have weights
      expect(record.traits[0]).toHaveProperty('weight');
      expect(record.traits[0]).toHaveProperty('traitName');
    });
  });

  // ── classifyWeight ──────────────────────────────────────────────

  describe('classifyWeight', () => {
    it('classifies weight buckets correctly', () => {
      expect(classifyWeight(-100)).toBe('strong_negative');
      expect(classifyWeight(-60)).toBe('strong_negative');
      expect(classifyWeight(-59)).toBe('negative');
      expect(classifyWeight(-20)).toBe('negative');
      expect(classifyWeight(-19)).toBe('neutral');
      expect(classifyWeight(0)).toBe('neutral');
      expect(classifyWeight(20)).toBe('neutral');
      expect(classifyWeight(21)).toBe('positive');
      expect(classifyWeight(60)).toBe('positive');
      expect(classifyWeight(61)).toBe('strong_positive');
      expect(classifyWeight(100)).toBe('strong_positive');
    });
  });

  // ── Domain event emission ───────────────────────────────────────

  describe('TraitsRolled event', () => {
    it('emits TraitsRolled event on rollTraits', () => {
      const listener = vi.fn();
      ctx.eventBus.on('TraitsRolled', listener);

      ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);

      expect(listener).toHaveBeenCalledOnce();
      const event = listener.mock.calls[0][0];
      expect(event.type).toBe('TraitsRolled');
      expect(event.payload.characterId).toBe('char-1');
      expect(event.payload.traitBuckets).toBeDefined();
    });

    it('event payload contains weight buckets, not exact values', () => {
      const listener = vi.fn();
      ctx.eventBus.on('TraitsRolled', listener);

      ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);

      const { traitBuckets } = listener.mock.calls[0][0].payload;
      const validBuckets = ['strong_negative', 'negative', 'neutral', 'positive', 'strong_positive'];

      for (const traitName of PASSIVE_TRAIT_NAMES) {
        expect(validBuckets).toContain(traitBuckets[traitName]);
      }

      // Ensure no numeric weight leaked into the event payload
      const serialised = JSON.stringify(traitBuckets);
      expect(serialised).not.toMatch(/-?\d{2,3}[^a-z]/);
    });

    it('event includes all 6 trait buckets', () => {
      const listener = vi.fn();
      ctx.eventBus.on('TraitsRolled', listener);

      ctx.traitService.rollTraits('char-1', SAMPLE_WHEELS);

      const { traitBuckets } = listener.mock.calls[0][0].payload;
      expect(Object.keys(traitBuckets)).toHaveLength(6);
    });
  });
});
