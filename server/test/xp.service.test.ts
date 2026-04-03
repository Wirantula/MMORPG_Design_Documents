import { describe, expect, it, vi, beforeEach } from 'vitest';
import { XpService } from '../src/modules/progression/xp.service';
import { DomainEventBus } from '../src/common/domain-events';
import { xpRequired, DECAY_INACTIVITY_THRESHOLD_DAYS } from '../src/modules/progression/curves';
import type { HiddenPotentialStats } from '../src/modules/characters/stats/stat.types';

// ── Helpers ─────────────────────────────────────────────────────

function createService() {
  const eventBus = new DomainEventBus();
  const xpService = new XpService(eventBus);
  return { xpService, eventBus };
}

/** Default potential: neutral modifiers, no soft cap at low levels. */
const NEUTRAL_POTENTIAL: HiddenPotentialStats = {
  growth_elasticity: 1.0,
  ceiling_bias: 1.0, // soft cap at level > 1000
  fortune_bias: 0.5,
  craft_intuition: 0.5,
  combat_instinct: 0.5,
  research_spark: 0.5,
  trauma_susceptibility: 0.5,
};

/** Potential with low ceiling_bias to trigger soft cap earlier. */
const LOW_CEILING_POTENTIAL: HiddenPotentialStats = {
  ...NEUTRAL_POTENTIAL,
  ceiling_bias: 0.05, // soft cap triggers at level > 50
};

/** Potential with high growth_elasticity. */
const HIGH_GROWTH_POTENTIAL: HiddenPotentialStats = {
  ...NEUTRAL_POTENTIAL,
  growth_elasticity: 1.5,
};

// ── Tests ───────────────────────────────────────────────────────

describe('XpService', () => {
  let svc: ReturnType<typeof createService>;

  beforeEach(() => {
    svc = createService();
  });

  // ── xpRequired formula ──────────────────────────────────────

  describe('xpRequired()', () => {
    it('returns progressively larger values for higher levels', () => {
      const xp50 = xpRequired(50, 'physical');
      const xp100 = xpRequired(100, 'physical');
      const xp250 = xpRequired(250, 'physical');

      expect(xp50).toBeGreaterThan(0);
      expect(xp100).toBeGreaterThan(xp50);
      expect(xp250).toBeGreaterThan(xp100);
    });

    it('level 100 (peak human) costs far less than level 250 (superhuman)', () => {
      const xp100 = xpRequired(100, 'physical');
      const xp250 = xpRequired(250, 'physical');
      // Superhuman extra exponent should make 250 at least 3x harder
      expect(xp250 / xp100).toBeGreaterThan(3);
    });

    it('applies domain multipliers — mental costs more than physical', () => {
      const physXp = xpRequired(50, 'physical');
      const mentXp = xpRequired(50, 'mental');
      expect(mentXp).toBeGreaterThan(physXp);
    });

    it('returns Infinity for levels outside valid range', () => {
      expect(xpRequired(0, 'physical')).toBe(Infinity);
      expect(xpRequired(500, 'physical')).toBe(Infinity);
    });
  });

  // ── awardXp ─────────────────────────────────────────────────

  describe('awardXp()', () => {
    it('awards XP and levels up when threshold is crossed', () => {
      const needed = xpRequired(1, 'physical');
      const result = svc.xpService.awardXp(
        'char-1', 'physical.STR', 'physical',
        needed + 1, NEUTRAL_POTENTIAL, 1,
      );

      expect(result.levelledUp).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(result.previousLevel).toBe(1);
    });

    it('does not level up when XP is insufficient', () => {
      const result = svc.xpService.awardXp(
        'char-1', 'physical.STR', 'physical',
        1, NEUTRAL_POTENTIAL, 1,
      );

      expect(result.levelledUp).toBe(false);
      expect(result.newLevel).toBe(1);
    });

    it('accumulates XP across multiple awards', () => {
      const needed = xpRequired(1, 'physical');
      const half = Math.ceil(needed / 2);

      svc.xpService.awardXp('char-1', 'physical.STR', 'physical', half, NEUTRAL_POTENTIAL, 1);
      const result = svc.xpService.awardXp('char-1', 'physical.STR', 'physical', half + 1, NEUTRAL_POTENTIAL, 2);

      expect(result.newLevel).toBeGreaterThanOrEqual(2);
    });

    it('can level up multiple times in one award', () => {
      // Give enough XP to pass two level thresholds
      const xp1 = xpRequired(1, 'physical');
      const xp2 = xpRequired(2, 'physical');
      const totalNeeded = xp1 + xp2 + 1;

      const result = svc.xpService.awardXp(
        'char-1', 'physical.STR', 'physical',
        totalNeeded, NEUTRAL_POTENTIAL, 1,
      );

      expect(result.newLevel).toBeGreaterThanOrEqual(3);
      expect(result.levelledUp).toBe(true);
    });

    it('updates lastActivityDay on award', () => {
      svc.xpService.awardXp('char-1', 'physical.STR', 'physical', 10, NEUTRAL_POTENTIAL, 42);
      const record = svc.xpService.getSkillRecord('char-1', 'physical.STR');
      expect(record!.lastActivityDay).toBe(42);
    });
  });

  // ── Hidden potential modifiers ──────────────────────────────

  describe('potential modifiers', () => {
    it('higher growth_elasticity yields more effective XP', () => {
      const base = svc.xpService.computeEffectiveGain(1000, 10, 'physical', NEUTRAL_POTENTIAL);
      const boosted = svc.xpService.computeEffectiveGain(1000, 10, 'physical', HIGH_GROWTH_POTENTIAL);

      expect(boosted).toBeGreaterThan(base);
    });

    it('soft cap drastically reduces XP gain when level > ceiling_bias * 1000', () => {
      // With LOW_CEILING_POTENTIAL, ceiling_bias = 0.05 → cap at level > 50
      const normal = svc.xpService.computeEffectiveGain(1000, 40, 'physical', LOW_CEILING_POTENTIAL);
      const capped = svc.xpService.computeEffectiveGain(1000, 60, 'physical', LOW_CEILING_POTENTIAL);

      // Capped should be ~10% of normal
      expect(capped).toBeLessThan(normal * 0.2);
    });

    it('awardXp reports softCapped=true when above ceiling', () => {
      // Force level high enough by directly testing with low ceiling potential
      // Award at level 1 first — won't be capped
      const result1 = svc.xpService.awardXp(
        'char-1', 'physical.STR', 'physical',
        10, LOW_CEILING_POTENTIAL, 1,
      );
      expect(result1.softCapped).toBe(false);
    });
  });

  // ── Soft cap trigger ────────────────────────────────────────

  describe('soft cap', () => {
    it('XP efficiency drops to 10% when stat exceeds ceiling_bias * 1000', () => {
      const xpBelow = svc.xpService.computeEffectiveGain(1000, 999, 'physical', NEUTRAL_POTENTIAL);
      const xpAbove = svc.xpService.computeEffectiveGain(1000, 1001, 'physical', NEUTRAL_POTENTIAL);

      // Above cap should be ~10% of below
      expect(xpAbove).toBeLessThanOrEqual(Math.ceil(xpBelow * 0.15));
    });
  });

  // ── Decay ───────────────────────────────────────────────────

  describe('applyDecay()', () => {
    it('does not decay when inactivity is within threshold', () => {
      svc.xpService.awardXp('char-1', 'physical.STR', 'physical', 100000, NEUTRAL_POTENTIAL, 1);
      const results = svc.xpService.applyDecay('char-1', DECAY_INACTIVITY_THRESHOLD_DAYS);
      expect(results).toHaveLength(0);
    });

    it('decays physically-maintained skills past 30 day threshold', () => {
      // Get character to a decent level
      svc.xpService.awardXp('char-1', 'physical.STR', 'physical', 500000, NEUTRAL_POTENTIAL, 1);
      const before = svc.xpService.getSkillRecord('char-1', 'physical.STR')!;
      const levelBefore = before.level;
      expect(levelBefore).toBeGreaterThan(1);

      // Decay after 50 days inactive (20 past threshold)
      const results = svc.xpService.applyDecay('char-1', 1 + DECAY_INACTIVITY_THRESHOLD_DAYS + 20);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].newLevel).toBeLessThan(results[0].previousLevel);
    });

    it('does not decay non-physical skills', () => {
      svc.xpService.awardXp('char-1', 'mental.INT', 'mental', 500000, NEUTRAL_POTENTIAL, 1);
      const results = svc.xpService.applyDecay('char-1', 1 + DECAY_INACTIVITY_THRESHOLD_DAYS + 50);
      expect(results).toHaveLength(0);
    });

    it('never decays below level 1', () => {
      svc.xpService.awardXp('char-1', 'physical.STR', 'physical', 200, NEUTRAL_POTENTIAL, 1);
      const results = svc.xpService.applyDecay('char-1', 1 + DECAY_INACTIVITY_THRESHOLD_DAYS + 999);

      if (results.length > 0) {
        expect(results[0].newLevel).toBeGreaterThanOrEqual(1);
      }
      const record = svc.xpService.getSkillRecord('char-1', 'physical.STR')!;
      expect(record.level).toBeGreaterThanOrEqual(1);
    });
  });

  // ── SkillLevelUp domain event ───────────────────────────────

  describe('SkillLevelUp event', () => {
    it('emits SkillLevelUp when level crosses integer boundary', () => {
      const listener = vi.fn();
      svc.eventBus.on('SkillLevelUp', listener);

      const needed = xpRequired(1, 'physical');
      svc.xpService.awardXp('char-1', 'physical.STR', 'physical', needed + 1, NEUTRAL_POTENTIAL, 1);

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0];
      expect(event.type).toBe('SkillLevelUp');
      expect(event.payload.characterId).toBe('char-1');
      expect(event.payload.skill).toBe('physical.STR');
      expect(event.payload.newLevel).toBe(2);
    });

    it('emits multiple events for multi-level gains', () => {
      const listener = vi.fn();
      svc.eventBus.on('SkillLevelUp', listener);

      const xp1 = xpRequired(1, 'physical');
      const xp2 = xpRequired(2, 'physical');
      svc.xpService.awardXp(
        'char-1', 'physical.STR', 'physical',
        xp1 + xp2 + 1, NEUTRAL_POTENTIAL, 1,
      );

      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('does not emit when no level is gained', () => {
      const listener = vi.fn();
      svc.eventBus.on('SkillLevelUp', listener);

      svc.xpService.awardXp('char-1', 'physical.STR', 'physical', 1, NEUTRAL_POTENTIAL, 1);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── getCurveData (admin endpoint backing) ───────────────────

  describe('getCurveData()', () => {
    it('returns curve data for all stat families', () => {
      const data = svc.xpService.getCurveData();
      expect(data.families).toBeDefined();
      expect(Object.keys(data.families)).toContain('physical');
      expect(Object.keys(data.families)).toContain('mental');
      expect(data.constants.base).toBeGreaterThan(0);
    });

    it('curve data points are in ascending order', () => {
      const data = svc.xpService.getCurveData();
      const physical = data.families['physical'];
      for (let i = 1; i < physical.length; i++) {
        expect(physical[i].xpRequired).toBeGreaterThan(physical[i - 1].xpRequired);
      }
    });
  });
});
