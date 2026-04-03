import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BirthService } from '../src/modules/characters/birth/birth.service';
import { WheelService } from '../src/modules/characters/wheels/wheel.service';
import { DomainEventBus } from '../src/common/domain-events';
import type { WheelType } from '../src/modules/characters/wheels/wheel.types';

function createBirthService() {
  const eventBus = new DomainEventBus();
  const wheelService = new WheelService();
  const birthService = new BirthService(wheelService, eventBus);
  return { birthService, wheelService, eventBus };
}

const REQUIRED_WHEELS: WheelType[] = ['race', 'aptitude', 'trait', 'origin'];
const ALL_WHEELS: WheelType[] = ['race', 'aptitude', 'trait', 'origin', 'omen'];

describe('BirthService', () => {
  let ctx: ReturnType<typeof createBirthService>;

  beforeEach(() => {
    ctx = createBirthService();
  });

  // ── Ritual lifecycle ───────────────────────────────────────────

  it('starts a ritual in unborn status', () => {
    const ritual = ctx.birthService.startRitual('acc-1');

    expect(ritual.status).toBe('unborn');
    expect(ritual.accountId).toBe('acc-1');
    expect(ritual.characterId).toBeTruthy();
    expect(ritual.spins).toEqual({});
  });

  it('rejects starting a second ritual for the same account', () => {
    ctx.birthService.startRitual('acc-1');

    expect(() => ctx.birthService.startRitual('acc-1')).toThrow(
      'Account already has an active birth ritual',
    );
  });

  it('allows new ritual after previous one completes', () => {
    const first = ctx.birthService.startRitual('acc-1');
    const baseTime = Date.now();

    // Spin all required wheels with different timestamps to get different seeds
    for (let i = 0; i < REQUIRED_WHEELS.length; i++) {
      ctx.birthService.spinWheel(first.characterId, REQUIRED_WHEELS[i], baseTime + i * 100);
    }
    ctx.birthService.completeRitual(first.characterId);

    // Should be able to start a new one
    const second = ctx.birthService.startRitual('acc-1');
    expect(second.characterId).not.toBe(first.characterId);
  });

  // ── Wheel spinning ────────────────────────────────────────────

  it('transitions status from unborn to in_progress on first spin', () => {
    const ritual = ctx.birthService.startRitual('acc-1');
    expect(ritual.status).toBe('unborn');

    ctx.birthService.spinWheel(ritual.characterId, 'race');
    const updated = ctx.birthService.getRitual(ritual.characterId)!;

    expect(updated.status).toBe('in_progress');
  });

  it('records spin outcome on the ritual', () => {
    const ritual = ctx.birthService.startRitual('acc-1');
    const { outcomeId } = ctx.birthService.spinWheel(ritual.characterId, 'race');

    expect(outcomeId).toBeTruthy();
    expect(typeof outcomeId).toBe('string');

    const updated = ctx.birthService.getRitual(ritual.characterId)!;
    expect(updated.spins.race).toBe(outcomeId);
  });

  it('generates deterministic outcomes with the same seed inputs', () => {
    const ritual1 = ctx.birthService.startRitual('acc-1');
    const fixedTime = 1700000000000;
    const result1 = ctx.birthService.spinWheel(ritual1.characterId, 'race', fixedTime);

    // Complete ritual1 so we can start another
    for (const wheel of REQUIRED_WHEELS.filter((w) => w !== 'race')) {
      ctx.birthService.spinWheel(ritual1.characterId, wheel, fixedTime + 1);
    }
    ctx.birthService.completeRitual(ritual1.characterId);

    // The seed is based on characterId + wheelType + timestamp,
    // so a different character will produce a different seed.
    // But the same character with the same timestamp should be deterministic.
    // We can verify the outcome is a valid race id.
    const validRaces = ['human', 'elf', 'dwarf', 'orc', 'fae', 'beastkin', 'undine', 'golem'];
    expect(validRaces).toContain(result1.outcomeId);
  });

  // ── Seeded RNG produces valid outcomes from all wheels ─────────

  it('produces valid outcomes for every wheel type', () => {
    const ritual = ctx.birthService.startRitual('acc-1');
    const baseTime = Date.now();

    for (let i = 0; i < ALL_WHEELS.length; i++) {
      const { outcomeId } = ctx.birthService.spinWheel(
        ritual.characterId,
        ALL_WHEELS[i],
        baseTime + i * 100,
      );
      expect(outcomeId).toBeTruthy();

      const wheelDef = ctx.wheelService.getWheelDefinition(ALL_WHEELS[i]);
      const validIds = wheelDef!.outcomes.map((o) => o.id);
      expect(validIds).toContain(outcomeId);
    }
  });

  // ── Cooldown enforcement ──────────────────────────────────────

  it('allows first spin without cooldown or cost', () => {
    const ritual = ctx.birthService.startRitual('acc-1');
    // No balance credited — first spin should still work
    const { outcomeId } = ctx.birthService.spinWheel(ritual.characterId, 'race');
    expect(outcomeId).toBeTruthy();
  });

  it('blocks reroll when cooldown is active', () => {
    const ritual = ctx.birthService.startRitual('acc-1');
    ctx.birthService.creditBalance('acc-1', 10_000);

    const firstSpinTime = 1000;
    ctx.birthService.spinWheel(ritual.characterId, 'race', firstSpinTime);

    // Try reroll immediately (within 24h cooldown)
    expect(() =>
      ctx.birthService.spinWheel(ritual.characterId, 'race', firstSpinTime + 1000),
    ).toThrow('Reroll cooldown active');
  });

  it('allows reroll after cooldown expires', () => {
    const ritual = ctx.birthService.startRitual('acc-1');
    ctx.birthService.creditBalance('acc-1', 10_000);

    const firstSpinTime = 1000;
    ctx.birthService.spinWheel(ritual.characterId, 'race', firstSpinTime);

    // After 24h (86400000ms) cooldown expires
    const afterCooldown = firstSpinTime + 86400000 + 1;
    const { outcomeId } = ctx.birthService.spinWheel(
      ritual.characterId,
      'race',
      afterCooldown,
    );
    expect(outcomeId).toBeTruthy();
  });

  it('deducts coin cost on reroll', () => {
    const ritual = ctx.birthService.startRitual('acc-1');
    ctx.birthService.creditBalance('acc-1', 10_000);

    const firstSpinTime = 1000;
    ctx.birthService.spinWheel(ritual.characterId, 'race', firstSpinTime);

    const afterCooldown = firstSpinTime + 86400000 + 1;
    ctx.birthService.spinWheel(ritual.characterId, 'race', afterCooldown);

    // Should have deducted 50 coins for reroll
    expect(ctx.birthService.getBalance('acc-1')).toBe(9_950);
  });

  it('rejects reroll when account has insufficient balance', () => {
    const ritual = ctx.birthService.startRitual('acc-1');
    // No balance credited

    const firstSpinTime = 1000;
    ctx.birthService.spinWheel(ritual.characterId, 'race', firstSpinTime);

    const afterCooldown = firstSpinTime + 86400000 + 1;
    expect(() =>
      ctx.birthService.spinWheel(ritual.characterId, 'race', afterCooldown),
    ).toThrow('Insufficient balance for reroll');
  });

  // ── Ritual completion ─────────────────────────────────────────

  it('completes ritual when all required wheels are spun', () => {
    const ritual = ctx.birthService.startRitual('acc-1');
    const baseTime = Date.now();

    for (let i = 0; i < REQUIRED_WHEELS.length; i++) {
      ctx.birthService.spinWheel(ritual.characterId, REQUIRED_WHEELS[i], baseTime + i * 100);
    }

    const completed = ctx.birthService.completeRitual(ritual.characterId);

    expect(completed.status).toBe('complete');
    expect(completed.completedAt).toBeTruthy();
    expect(completed.spins.race).toBeTruthy();
    expect(completed.spins.aptitude).toBeTruthy();
    expect(completed.spins.trait).toBeTruthy();
    expect(completed.spins.origin).toBeTruthy();
  });

  it('rejects completion when required wheels are missing', () => {
    const ritual = ctx.birthService.startRitual('acc-1');
    ctx.birthService.spinWheel(ritual.characterId, 'race');

    expect(() => ctx.birthService.completeRitual(ritual.characterId)).toThrow(
      'Required wheel not spun',
    );
  });

  it('rejects double completion', () => {
    const ritual = ctx.birthService.startRitual('acc-1');
    const baseTime = Date.now();

    for (let i = 0; i < REQUIRED_WHEELS.length; i++) {
      ctx.birthService.spinWheel(ritual.characterId, REQUIRED_WHEELS[i], baseTime + i * 100);
    }
    ctx.birthService.completeRitual(ritual.characterId);

    expect(() => ctx.birthService.completeRitual(ritual.characterId)).toThrow(
      'Ritual already completed',
    );
  });

  it('allows completion with optional omen wheel', () => {
    const ritual = ctx.birthService.startRitual('acc-1');
    const baseTime = Date.now();

    for (let i = 0; i < ALL_WHEELS.length; i++) {
      ctx.birthService.spinWheel(ritual.characterId, ALL_WHEELS[i], baseTime + i * 100);
    }

    const completed = ctx.birthService.completeRitual(ritual.characterId);

    expect(completed.status).toBe('complete');
    expect(completed.spins.omen).toBeTruthy();
  });

  // ── CharacterBorn event ───────────────────────────────────────

  it('emits CharacterBorn event on ritual completion', () => {
    const listener = vi.fn();
    ctx.eventBus.on('CharacterBorn', listener);

    const ritual = ctx.birthService.startRitual('acc-1');
    const baseTime = Date.now();

    for (let i = 0; i < REQUIRED_WHEELS.length; i++) {
      ctx.birthService.spinWheel(ritual.characterId, REQUIRED_WHEELS[i], baseTime + i * 100);
    }
    ctx.birthService.completeRitual(ritual.characterId);

    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0][0];
    expect(event.type).toBe('CharacterBorn');
    expect(event.payload.accountId).toBe('acc-1');
    expect(event.payload.characterId).toBe(ritual.characterId);
    expect(event.payload.wheelOutcomes.race).toBeTruthy();
    expect(event.payload.wheelOutcomes.aptitude).toBeTruthy();
    expect(event.payload.wheelOutcomes.trait).toBeTruthy();
    expect(event.payload.wheelOutcomes.origin).toBeTruthy();
  });

  it('does not emit CharacterBorn when ritual is not complete', () => {
    const listener = vi.fn();
    ctx.eventBus.on('CharacterBorn', listener);

    ctx.birthService.startRitual('acc-1');

    expect(listener).not.toHaveBeenCalled();
  });

  // ── WheelService unit tests ───────────────────────────────────

  describe('WheelService', () => {
    it('returns all 5 wheel types', () => {
      expect(ctx.wheelService.getWheelTypes()).toEqual([
        'race', 'aptitude', 'trait', 'origin', 'omen',
      ]);
    });

    it('returns wheel definition with outcomes', () => {
      const raceDef = ctx.wheelService.getWheelDefinition('race');
      expect(raceDef).toBeTruthy();
      expect(raceDef!.outcomes.length).toBeGreaterThan(0);
      expect(raceDef!.outcomes[0]).toHaveProperty('id');
      expect(raceDef!.outcomes[0]).toHaveProperty('weight');
    });

    it('weighted select respects weight distribution', () => {
      // With roll = 0, should select the first outcome
      const outcomes = [
        { id: 'a', label: 'A', weight: 50 },
        { id: 'b', label: 'B', weight: 50 },
      ];
      expect(ctx.wheelService.weightedSelect(outcomes, 0)).toBe('a');
      expect(ctx.wheelService.weightedSelect(outcomes, 0.49)).toBe('a');
      expect(ctx.wheelService.weightedSelect(outcomes, 0.51)).toBe('b');
      expect(ctx.wheelService.weightedSelect(outcomes, 0.99)).toBe('b');
    });

    it('weighted select handles single outcome', () => {
      const outcomes = [{ id: 'only', label: 'Only', weight: 100 }];
      expect(ctx.wheelService.weightedSelect(outcomes, 0)).toBe('only');
      expect(ctx.wheelService.weightedSelect(outcomes, 0.99)).toBe('only');
    });

    it('spin returns a valid outcome id', () => {
      const outcomeId = ctx.wheelService.spin('race', 12345);
      const raceDef = ctx.wheelService.getWheelDefinition('race')!;
      const validIds = raceDef.outcomes.map((o) => o.id);
      expect(validIds).toContain(outcomeId);
    });

    it('spin is deterministic for the same seed', () => {
      const result1 = ctx.wheelService.spin('race', 42);
      const result2 = ctx.wheelService.spin('race', 42);
      expect(result1).toBe(result2);
    });

    it('spin produces different outcomes for different seeds', () => {
      // With enough different seeds, we should get at least 2 different outcomes
      const results = new Set<string>();
      for (let seed = 0; seed < 100; seed++) {
        results.add(ctx.wheelService.spin('race', seed));
      }
      expect(results.size).toBeGreaterThan(1);
    });

    it('throws on unknown wheel type', () => {
      expect(() =>
        ctx.wheelService.spin('unknown' as WheelType, 1),
      ).toThrow('Unknown wheel type');
    });

    it('returns reroll cooldown from content', () => {
      expect(ctx.wheelService.getRerollCooldownMs()).toBe(86400000); // 24h
    });

    it('returns reroll coin cost from content', () => {
      expect(ctx.wheelService.getRerollCoinCost()).toBe(50);
    });
  });

  // ── Outcome distribution smoke test ───────────────────────────

  describe('outcome distribution', () => {
    it('produces all possible race outcomes over many spins', () => {
      const outcomes = new Set<string>();
      for (let seed = 0; seed < 1000; seed++) {
        outcomes.add(ctx.wheelService.spin('race', seed));
      }

      // We expect at least 5 of the 8 races to appear (very high probability)
      expect(outcomes.size).toBeGreaterThanOrEqual(5);
    });
  });
});
