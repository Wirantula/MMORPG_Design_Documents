import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StatService } from '../src/modules/characters/stats/stat.service';
import { DomainEventBus } from '../src/common/domain-events';
import { STAT_MIN, STAT_MAX, POTENTIAL_MIN, POTENTIAL_MAX } from '../src/modules/characters/stats/stat.constants';
import { STAT_FAMILIES, HIDDEN_POTENTIAL_KEYS } from '../src/modules/characters/stats/stat.types';
import type { WheelOutcomesInput } from '../src/modules/characters/stats/stat.types';

function createStatService() {
  const eventBus = new DomainEventBus();
  const statService = new StatService(eventBus);
  return { statService, eventBus };
}

const SAMPLE_WHEELS: WheelOutcomesInput = {
  race: 'elf',
  aptitude: 'scholar',
  trait: 'cunning',
  origin: 'noble',
};

const SAMPLE_WHEELS_WITH_OMEN: WheelOutcomesInput = {
  ...SAMPLE_WHEELS,
  omen: 'star',
};

describe('StatService', () => {
  let ctx: ReturnType<typeof createStatService>;

  beforeEach(() => {
    ctx = createStatService();
  });

  // ── Initialisation ──────────────────────────────────────────────

  it('initialises stats from wheel results', () => {
    const record = ctx.statService.initStats('chr-1', SAMPLE_WHEELS);

    expect(record.characterId).toBe('chr-1');
    expect(record.visible).toBeTruthy();
    expect(record.potential).toBeTruthy();
    expect(record.initialisedAt).toBeTruthy();
  });

  it('rejects double initialisation for the same character', () => {
    ctx.statService.initStats('chr-1', SAMPLE_WHEELS);

    expect(() => ctx.statService.initStats('chr-1', SAMPLE_WHEELS)).toThrow(
      'Stats already initialised',
    );
  });

  it('produces deterministic stats for the same character id and wheel inputs', () => {
    const record1 = ctx.statService.initStats('chr-det', SAMPLE_WHEELS);

    // Create a fresh service to verify determinism
    const { statService: fresh } = createStatService();
    const record2 = fresh.initStats('chr-det', SAMPLE_WHEELS);

    expect(record1.visible).toEqual(record2.visible);
    expect(record1.potential).toEqual(record2.potential);
  });

  it('produces different stats for different character ids', () => {
    const record1 = ctx.statService.initStats('chr-a', SAMPLE_WHEELS);

    const { statService: fresh } = createStatService();
    const record2 = fresh.initStats('chr-b', SAMPLE_WHEELS);

    // With different character ids, the seeds differ
    // (we cannot guarantee every stat differs, but the overall record should)
    expect(
      JSON.stringify(record1.visible) !== JSON.stringify(record2.visible) ||
      JSON.stringify(record1.potential) !== JSON.stringify(record2.potential),
    ).toBe(true);
  });

  // ── Visible stat families ─────────────────────────────────────

  it('generates all 6 visible stat families', () => {
    const record = ctx.statService.initStats('chr-fam', SAMPLE_WHEELS);

    for (const family of STAT_FAMILIES) {
      expect(record.visible[family]).toBeTruthy();
    }
  });

  it('all visible stats are within valid range [0, 1_000_000]', () => {
    const record = ctx.statService.initStats('chr-range', SAMPLE_WHEELS);

    const allValues: number[] = [
      ...Object.values(record.visible.physical),
      ...Object.values(record.visible.mental),
      ...Object.values(record.visible.social),
      ...Object.values(record.visible.perceptual),
      ...Object.values(record.visible.spiritual),
      ...Object.values(record.visible.economic),
    ];

    for (const val of allValues) {
      expect(val).toBeGreaterThanOrEqual(STAT_MIN);
      expect(val).toBeLessThanOrEqual(STAT_MAX);
    }
  });

  it('physical family has STR, AGI, END, REC', () => {
    const record = ctx.statService.initStats('chr-phys', SAMPLE_WHEELS);
    expect(record.visible.physical).toHaveProperty('STR');
    expect(record.visible.physical).toHaveProperty('AGI');
    expect(record.visible.physical).toHaveProperty('END');
    expect(record.visible.physical).toHaveProperty('REC');
  });

  it('mental family has INT, FOC, CRE, MEM', () => {
    const record = ctx.statService.initStats('chr-ment', SAMPLE_WHEELS);
    expect(record.visible.mental).toHaveProperty('INT');
    expect(record.visible.mental).toHaveProperty('FOC');
    expect(record.visible.mental).toHaveProperty('CRE');
    expect(record.visible.mental).toHaveProperty('MEM');
  });

  it('social family has CHA, AUT, EMP, DEC', () => {
    const record = ctx.statService.initStats('chr-soc', SAMPLE_WHEELS);
    expect(record.visible.social).toHaveProperty('CHA');
    expect(record.visible.social).toHaveProperty('AUT');
    expect(record.visible.social).toHaveProperty('EMP');
    expect(record.visible.social).toHaveProperty('DEC');
  });

  it('perceptual family has AWR, PRE, INS', () => {
    const record = ctx.statService.initStats('chr-perc', SAMPLE_WHEELS);
    expect(record.visible.perceptual).toHaveProperty('AWR');
    expect(record.visible.perceptual).toHaveProperty('PRE');
    expect(record.visible.perceptual).toHaveProperty('INS');
  });

  it('spiritual family has WIL, RES, AET', () => {
    const record = ctx.statService.initStats('chr-spir', SAMPLE_WHEELS);
    expect(record.visible.spiritual).toHaveProperty('WIL');
    expect(record.visible.spiritual).toHaveProperty('RES');
    expect(record.visible.spiritual).toHaveProperty('AET');
  });

  it('economic family has APR, NEG, LOG', () => {
    const record = ctx.statService.initStats('chr-econ', SAMPLE_WHEELS);
    expect(record.visible.economic).toHaveProperty('APR');
    expect(record.visible.economic).toHaveProperty('NEG');
    expect(record.visible.economic).toHaveProperty('LOG');
  });

  // ── Hidden potential ──────────────────────────────────────────

  it('generates all 7 hidden potential keys', () => {
    const record = ctx.statService.initStats('chr-pot', SAMPLE_WHEELS);

    for (const key of HIDDEN_POTENTIAL_KEYS) {
      expect(record.potential).toHaveProperty(key);
    }
  });

  it('all potential values are within [0, 100]', () => {
    const record = ctx.statService.initStats('chr-potrange', SAMPLE_WHEELS);

    for (const key of HIDDEN_POTENTIAL_KEYS) {
      const val = record.potential[key];
      expect(val).toBeGreaterThanOrEqual(POTENTIAL_MIN);
      expect(val).toBeLessThanOrEqual(POTENTIAL_MAX);
    }
  });

  it('omen wheel influences potential stats', () => {
    const withOmen = ctx.statService.initStats('chr-omen1', SAMPLE_WHEELS_WITH_OMEN);

    const { statService: fresh } = createStatService();
    const withoutOmen = fresh.initStats('chr-omen1', SAMPLE_WHEELS);

    // The same character id but different omen should produce different potential
    expect(
      JSON.stringify(withOmen.potential) !== JSON.stringify(withoutOmen.potential),
    ).toBe(true);
  });

  // ── Player-facing DTO excludes hidden layer ───────────────────

  it('getVisibleStats returns only visible stats, no potential', () => {
    ctx.statService.initStats('chr-vis', SAMPLE_WHEELS);
    const dto = ctx.statService.getVisibleStats('chr-vis');

    expect(dto).toBeTruthy();
    expect(dto!.characterId).toBe('chr-vis');
    expect(dto!.stats).toBeTruthy();

    // Ensure hidden potential is NOT present in the DTO
    const serialised = JSON.stringify(dto);
    expect(serialised).not.toContain('growth_elasticity');
    expect(serialised).not.toContain('ceiling_bias');
    expect(serialised).not.toContain('fortune_bias');
    expect(serialised).not.toContain('craft_intuition');
    expect(serialised).not.toContain('combat_instinct');
    expect(serialised).not.toContain('research_spark');
    expect(serialised).not.toContain('trauma_susceptibility');
    expect(serialised).not.toContain('potential');
  });

  it('getVisibleStats returns undefined for unknown character', () => {
    expect(ctx.statService.getVisibleStats('nonexistent')).toBeUndefined();
  });

  // ── Admin potential endpoint ──────────────────────────────────

  it('getPotentialStats returns hidden layer for admin', () => {
    ctx.statService.initStats('chr-admin', SAMPLE_WHEELS);
    const dto = ctx.statService.getPotentialStats('chr-admin');

    expect(dto).toBeTruthy();
    expect(dto!.characterId).toBe('chr-admin');
    expect(dto!.potential).toBeTruthy();

    for (const key of HIDDEN_POTENTIAL_KEYS) {
      expect(dto!.potential).toHaveProperty(key);
    }
  });

  it('getPotentialStats returns undefined for unknown character', () => {
    expect(ctx.statService.getPotentialStats('nonexistent')).toBeUndefined();
  });

  // ── Domain event emission ─────────────────────────────────────

  it('emits StatsInitialised event on initStats', () => {
    const listener = vi.fn();
    ctx.eventBus.on('StatsInitialised', listener);

    ctx.statService.initStats('chr-evt', SAMPLE_WHEELS);

    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0][0];
    expect(event.type).toBe('StatsInitialised');
    expect(event.payload.characterId).toBe('chr-evt');
    expect(event.payload.statFamilyCount).toBe(6);
    expect(event.payload.potentialKeyCount).toBe(7);
  });

  // ── Wheel outcome handling ────────────────────────────────────

  it('handles unknown wheel outcomes gracefully (no bias applied)', () => {
    const unknownWheels: WheelOutcomesInput = {
      race: 'unknown_race',
      aptitude: 'unknown_apt',
      trait: 'unknown_trait',
      origin: 'unknown_origin',
    };

    // Should not throw — just applies zero bias
    const record = ctx.statService.initStats('chr-unknown', unknownWheels);
    expect(record.visible).toBeTruthy();
    expect(record.potential).toBeTruthy();
  });

  it('getFullRecord returns the complete internal record', () => {
    ctx.statService.initStats('chr-full', SAMPLE_WHEELS);
    const record = ctx.statService.getFullRecord('chr-full');

    expect(record).toBeTruthy();
    expect(record!.visible).toBeTruthy();
    expect(record!.potential).toBeTruthy();
    expect(record!.initialisedAt).toBeTruthy();
  });
});
