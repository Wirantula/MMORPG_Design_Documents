import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  NeedsService,
  NEED_DIMENSIONS,
  DEFAULT_DECAY_RATES,
} from '../src/modules/needs/needs.service';
import { DomainEventBus } from '../src/common/domain-events';

function createService() {
  const eventBus = new DomainEventBus();
  const needsService = new NeedsService(eventBus);
  return { needsService, eventBus };
}

describe('NeedsService', () => {
  let svc: ReturnType<typeof createService>;

  beforeEach(() => {
    svc = createService();
  });

  // ── Initialisation ───────────────────────────────────────────

  it('initialises all needs to 100 for a new character', () => {
    const needs = svc.needsService.getNeeds('char-1');
    for (const dim of NEED_DIMENSIONS) {
      expect(needs[dim]).toBe(100);
    }
  });

  // ── decayNeeds ───────────────────────────────────────────────

  it('decays each dimension by the configured rate after one day', () => {
    // Force init
    svc.needsService.getNeeds('char-1');

    svc.needsService.decayNeeds(1);

    const needs = svc.needsService.getNeeds('char-1');
    for (const dim of NEED_DIMENSIONS) {
      expect(needs[dim]).toBe(100 - DEFAULT_DECAY_RATES[dim]);
    }
  });

  it('decays cumulatively over multiple days', () => {
    svc.needsService.getNeeds('char-1');

    svc.needsService.decayNeeds(1);
    svc.needsService.decayNeeds(2);
    svc.needsService.decayNeeds(3);

    const needs = svc.needsService.getNeeds('char-1');
    for (const dim of NEED_DIMENSIONS) {
      const expected = Math.max(0, 100 - DEFAULT_DECAY_RATES[dim] * 3);
      expect(needs[dim]).toBe(expected);
    }
  });

  it('clamps needs at 0 (never goes negative)', () => {
    svc.needsService.getNeeds('char-1');

    // Decay many times — nutrition (rate 15) hits 0 after 7 days
    for (let day = 1; day <= 10; day++) {
      svc.needsService.decayNeeds(day);
    }

    const needs = svc.needsService.getNeeds('char-1');
    for (const dim of NEED_DIMENSIONS) {
      expect(needs[dim]).toBeGreaterThanOrEqual(0);
    }
    // nutrition: 100 - 15*10 = -50 → clamped to 0
    expect(needs.nutrition).toBe(0);
  });

  it('returns number of characters processed', () => {
    svc.needsService.getNeeds('char-1');
    svc.needsService.getNeeds('char-2');
    const count = svc.needsService.decayNeeds(1);
    expect(count).toBe(2);
  });

  // ── getModifier ──────────────────────────────────────────────

  it('returns 1.10 when all needs are full (100)', () => {
    const modifier = svc.needsService.getModifier('char-1');
    expect(modifier).toBe(1.10);
  });

  it('returns 0.70 when all needs are critical (< 10)', () => {
    svc.needsService.getNeeds('char-1');

    // Decay enough times to bring everything below 10
    for (let day = 1; day <= 40; day++) {
      svc.needsService.decayNeeds(day);
    }

    const modifier = svc.needsService.getModifier('char-1');
    expect(modifier).toBe(0.70);
  });

  it('returns a value between 0.70 and 1.10 for intermediate need levels', () => {
    svc.needsService.getNeeds('char-1');
    svc.needsService.decayNeeds(1); // One day of decay

    const modifier = svc.needsService.getModifier('char-1');
    expect(modifier).toBeGreaterThan(0.70);
    expect(modifier).toBeLessThan(1.10);
  });

  // ── getNeedsStatus ───────────────────────────────────────────

  it('labels needs as "full" when at 100', () => {
    const statuses = svc.needsService.getNeedsStatus('char-1');
    for (const entry of statuses) {
      expect(entry.status).toBe('full');
      expect(entry.value).toBe(100);
    }
    expect(statuses).toHaveLength(5);
  });

  it('labels needs correctly at various thresholds', () => {
    expect(NeedsService.classifyStatus(100)).toBe('full');
    expect(NeedsService.classifyStatus(50)).toBe('ok');
    expect(NeedsService.classifyStatus(25)).toBe('low');
    expect(NeedsService.classifyStatus(5)).toBe('critical');
    expect(NeedsService.classifyStatus(0)).toBe('critical');
  });

  // ── triggerWarnings ──────────────────────────────────────────

  it('emits NeedsCriticalWarning when a dimension drops below 10', () => {
    const listener = vi.fn();
    svc.eventBus.on('NeedsCriticalWarning', listener);

    svc.needsService.getNeeds('char-1');

    // Decay nutrition (rate 15) for 7 days: 100 - 105 = clamped 0 → critical
    for (let day = 1; day <= 7; day++) {
      svc.needsService.decayNeeds(day);
    }

    // Should have been called at least once for nutrition
    const nutritionWarnings = listener.mock.calls.filter(
      (call: unknown[]) =>
        (call[0] as { payload: { dimension: string } }).payload.dimension === 'nutrition',
    );
    expect(nutritionWarnings.length).toBeGreaterThan(0);
  });

  it('does not emit warnings when all needs are above critical', () => {
    const listener = vi.fn();
    svc.eventBus.on('NeedsCriticalWarning', listener);

    svc.needsService.getNeeds('char-1');
    svc.needsService.decayNeeds(1); // One day — lowest is nutrition at 85

    expect(listener).not.toHaveBeenCalled();
  });

  // ── adjustNeed ───────────────────────────────────────────────

  it('allows recovery of a specific need dimension', () => {
    svc.needsService.getNeeds('char-1');
    svc.needsService.decayNeeds(1); // nutrition → 85

    svc.needsService.adjustNeed('char-1', 'nutrition', 15);
    const needs = svc.needsService.getNeeds('char-1');
    expect(needs.nutrition).toBe(100);
  });

  it('clamps adjusted need to 100', () => {
    svc.needsService.getNeeds('char-1'); // nutrition = 100
    svc.needsService.adjustNeed('char-1', 'nutrition', 50);
    const needs = svc.needsService.getNeeds('char-1');
    expect(needs.nutrition).toBe(100);
  });
});
