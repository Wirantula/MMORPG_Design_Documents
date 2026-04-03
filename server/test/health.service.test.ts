import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HealthService } from '../src/modules/health/health.service';
import { DomainEventBus } from '../src/common/domain-events';

function createService() {
  const eventBus = new DomainEventBus();
  const healthService = new HealthService(eventBus);
  return { healthService, eventBus };
}

describe('HealthService', () => {
  let svc: ReturnType<typeof createService>;

  beforeEach(() => {
    svc = createService();
  });

  // ── Condition application ─────────────────────────────────────

  it('applies a wound condition with correct defaults', () => {
    const result = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 3,
      currentGameDay: 10,
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('wound');
    expect(result!.severity).toBe(3);
    expect(result!.durationDays).toBe(14); // severity 3 → 14 days
    expect(result!.startedAtDay).toBe(10);
    expect(result!.resolvesAtDay).toBe(24);
    expect(result!.statPenaltyModifier).toBe(0.20);
    expect(result!.recoveryActionRequired).toBe('rest_or_surgery');
    expect(result!.treatedBySkill).toBeNull();
  });

  it('applies all four condition types', () => {
    const types = ['wound', 'illness', 'exhaustion', 'poisoning'] as const;
    for (const type of types) {
      const result = svc.healthService.applyCondition({
        characterId: 'char-1',
        type,
        severity: 1,
        currentGameDay: 0,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe(type);
    }
    expect(svc.healthService.getConditions('char-1')).toHaveLength(4);
  });

  it('assigns correct duration per severity level', () => {
    const expected: Record<number, number> = { 1: 3, 2: 7, 3: 14, 4: 28, 5: 56 };
    for (const [sev, dur] of Object.entries(expected)) {
      const result = svc.healthService.applyCondition({
        characterId: `char-sev-${sev}`,
        type: 'wound',
        severity: Number(sev),
        currentGameDay: 0,
      });
      expect(result!.durationDays).toBe(dur);
    }
  });

  it('handles chronic illness with extended duration', () => {
    const result = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'illness',
      severity: 2,
      illnessSubtype: 'chronic',
      currentGameDay: 0,
    });

    expect(result).not.toBeNull();
    expect(result!.illnessSubtype).toBe('chronic');
    // severity 2 base is 7 days × 3 (chronic multiplier) = 21
    expect(result!.durationDays).toBe(21);
  });

  it('handles acute illness with normal duration', () => {
    const result = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'illness',
      severity: 2,
      illnessSubtype: 'acute',
      currentGameDay: 0,
    });

    expect(result).not.toBeNull();
    expect(result!.illnessSubtype).toBe('acute');
    expect(result!.durationDays).toBe(7);
  });

  it('clamps severity to 1–5 range', () => {
    const tooHigh = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 10,
      currentGameDay: 0,
    });
    expect(tooHigh!.severity).toBeLessThanOrEqual(5);

    const tooLow = svc.healthService.applyCondition({
      characterId: 'char-2',
      type: 'wound',
      severity: -1,
      currentGameDay: 0,
    });
    expect(tooLow!.severity).toBeGreaterThanOrEqual(1);
  });

  // ── Stacking with diminishing severity ────────────────────────

  it('diminishes severity when stacking same-type conditions', () => {
    const first = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 4,
      currentGameDay: 0,
    });
    expect(first!.severity).toBe(4);

    const second = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 4,
      currentGameDay: 0,
    });
    // 4 * 0.5^1 = 2
    expect(second!.severity).toBe(2);

    const third = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 4,
      currentGameDay: 0,
    });
    // 4 * 0.5^2 = 1
    expect(third!.severity).toBe(1);
  });

  it('does not diminish severity for different condition types', () => {
    svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 3,
      currentGameDay: 0,
    });

    const illness = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'illness',
      severity: 3,
      currentGameDay: 0,
    });
    // No stacking since different type
    expect(illness!.severity).toBe(3);
  });

  // ── Treatment reduction ───────────────────────────────────────

  it('reduces wound recovery time by 50% with Surgery skill', () => {
    const wound = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 3,
      currentGameDay: 10,
    });
    // duration = 14 days, resolves at day 24

    const newResolvesAt = svc.healthService.getTreatmentReduction(
      'char-1',
      wound!.id,
      'Surgery',
      10,
    );

    // remaining = 14, reduced = round(14 * 0.5) = 7, new resolves = 10 + 7 = 17
    expect(newResolvesAt).toBe(17);
  });

  it('reduces illness recovery time by 50% with Medicine skill', () => {
    const illness = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'illness',
      severity: 2,
      currentGameDay: 5,
    });

    const newResolvesAt = svc.healthService.getTreatmentReduction(
      'char-1',
      illness!.id,
      'Medicine',
      5,
    );

    // remaining = 7, reduced = round(7 * 0.5) = 4, new resolves = 5 + 4 = 9
    expect(newResolvesAt).toBe(9);
  });

  it('reduces exhaustion recovery time by 30% with Herbalism skill', () => {
    const exhaustion = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'exhaustion',
      severity: 3,
      currentGameDay: 0,
    });

    const newResolvesAt = svc.healthService.getTreatmentReduction(
      'char-1',
      exhaustion!.id,
      'Herbalism',
      0,
    );

    // remaining = 14, reduced = round(14 * 0.7) = 10, new resolves = 0 + 10 = 10
    expect(newResolvesAt).toBe(10);
  });

  it('rejects treatment with non-matching skill', () => {
    const wound = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 2,
      currentGameDay: 0,
    });

    const result = svc.healthService.getTreatmentReduction(
      'char-1',
      wound!.id,
      'Medicine', // Medicine doesn't apply to wounds
      0,
    );

    expect(result).toBeNull();
  });

  it('rejects second treatment on same condition', () => {
    const wound = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 3,
      currentGameDay: 0,
    });

    svc.healthService.getTreatmentReduction('char-1', wound!.id, 'Surgery', 0);
    const secondAttempt = svc.healthService.getTreatmentReduction(
      'char-1',
      wound!.id,
      'Surgery',
      0,
    );

    expect(secondAttempt).toBeNull();
  });

  // ── Infant/child safety ───────────────────────────────────────

  it('blocks lethal conditions (severity 5) for infants', () => {
    const result = svc.healthService.applyCondition({
      characterId: 'baby-1',
      type: 'wound',
      severity: 5,
      currentGameDay: 0,
      lifeStage: 'infant',
    });

    expect(result).toBeNull();
    expect(svc.healthService.getConditions('baby-1')).toHaveLength(0);
  });

  it('blocks lethal conditions (severity 5) for children', () => {
    const result = svc.healthService.applyCondition({
      characterId: 'child-1',
      type: 'poisoning',
      severity: 5,
      currentGameDay: 0,
      lifeStage: 'child',
    });

    expect(result).toBeNull();
  });

  it('allows non-lethal conditions for infants', () => {
    const result = svc.healthService.applyCondition({
      characterId: 'baby-1',
      type: 'illness',
      severity: 2,
      currentGameDay: 0,
      lifeStage: 'infant',
    });

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(2);
  });

  it('allows lethal conditions for adults', () => {
    const result = svc.healthService.applyCondition({
      characterId: 'adult-1',
      type: 'wound',
      severity: 5,
      currentGameDay: 0,
      lifeStage: 'adult',
    });

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(5);
  });

  it('allows lethal conditions when lifeStage is not provided', () => {
    const result = svc.healthService.applyCondition({
      characterId: 'unknown-1',
      type: 'wound',
      severity: 5,
      currentGameDay: 0,
    });

    expect(result).not.toBeNull();
  });

  it('checkInfantSafety returns false for severity 5 + infant', () => {
    expect(svc.healthService.checkInfantSafety(5, 'infant')).toBe(false);
  });

  it('checkInfantSafety returns false for severity 5 + child', () => {
    expect(svc.healthService.checkInfantSafety(5, 'child')).toBe(false);
  });

  it('checkInfantSafety returns true for severity 4 + infant', () => {
    expect(svc.healthService.checkInfantSafety(4, 'infant')).toBe(true);
  });

  it('checkInfantSafety returns true for severity 5 + teen', () => {
    expect(svc.healthService.checkInfantSafety(5, 'teen')).toBe(true);
  });

  // ── Condition resolution ──────────────────────────────────────

  it('resolves a condition by ID', () => {
    const condition = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 1,
      currentGameDay: 0,
    });

    const resolved = svc.healthService.resolveCondition('char-1', condition!.id);
    expect(resolved).toBe(true);
    expect(svc.healthService.getConditions('char-1')).toHaveLength(0);
  });

  it('returns false when resolving non-existent condition', () => {
    expect(svc.healthService.resolveCondition('char-1', 'nope')).toBe(false);
  });

  it('auto-resolves expired conditions on tick', () => {
    svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 1,
      currentGameDay: 0,
    });
    // severity 1 → 3 days, resolves at day 3

    const resolved = svc.healthService.resolveExpiredConditions(3);
    expect(resolved).toBe(1);
    expect(svc.healthService.getConditions('char-1')).toHaveLength(0);
  });

  it('does not resolve conditions before their resolves-at day', () => {
    svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 2,
      currentGameDay: 0,
    });
    // severity 2 → 7 days

    const resolved = svc.healthService.resolveExpiredConditions(5);
    expect(resolved).toBe(0);
    expect(svc.healthService.getConditions('char-1')).toHaveLength(1);
  });

  // ── Prognosis ─────────────────────────────────────────────────

  it('returns prognosis with remaining days', () => {
    svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 2,
      currentGameDay: 5,
    });

    const prognosis = svc.healthService.getConditionsWithPrognosis('char-1', 8);
    expect(prognosis).toHaveLength(1);
    expect(prognosis[0].remainingDays).toBe(4); // resolves at 12, current 8
    expect(prognosis[0].isExpired).toBe(false);
  });

  it('marks expired conditions in prognosis', () => {
    svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 1,
      currentGameDay: 0,
    });

    const prognosis = svc.healthService.getConditionsWithPrognosis('char-1', 5);
    expect(prognosis[0].remainingDays).toBe(0);
    expect(prognosis[0].isExpired).toBe(true);
  });

  // ── Stat penalty ──────────────────────────────────────────────

  it('computes total stat penalty from active conditions', () => {
    svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 3,
      currentGameDay: 0,
    });
    svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'illness',
      severity: 2,
      currentGameDay: 0,
    });

    const penalty = svc.healthService.getTotalStatPenalty('char-1');
    // wound sev 3 = 0.20 + illness sev 2 = 0.10 → 0.30
    expect(penalty).toBeCloseTo(0.30);
  });

  it('caps total penalty at 0.80', () => {
    // Apply many conditions to different characters that stack
    for (let i = 0; i < 5; i++) {
      svc.healthService.applyCondition({
        characterId: 'char-heavy',
        type: (['wound', 'illness', 'exhaustion', 'poisoning'] as const)[i % 4],
        severity: 5,
        currentGameDay: 0,
      });
    }

    const penalty = svc.healthService.getTotalStatPenalty('char-heavy');
    expect(penalty).toBeLessThanOrEqual(0.80);
  });

  // ── Domain events ─────────────────────────────────────────────

  it('emits ConditionApplied event when condition is applied', () => {
    const listener = vi.fn();
    svc.eventBus.on('ConditionApplied', listener);

    svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 2,
      currentGameDay: 0,
    });

    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0][0];
    expect(event.payload.characterId).toBe('char-1');
    expect(event.payload.conditionType).toBe('wound');
    expect(event.payload.severity).toBe(2);
  });

  it('emits ConditionResolved event when condition is resolved', () => {
    const listener = vi.fn();
    svc.eventBus.on('ConditionResolved', listener);

    const condition = svc.healthService.applyCondition({
      characterId: 'char-1',
      type: 'wound',
      severity: 1,
      currentGameDay: 0,
    });

    svc.healthService.resolveCondition('char-1', condition!.id);

    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0][0];
    expect(event.payload.characterId).toBe('char-1');
    expect(event.payload.conditionType).toBe('wound');
  });

  it('does not emit ConditionApplied when infant safety blocks', () => {
    const listener = vi.fn();
    svc.eventBus.on('ConditionApplied', listener);

    svc.healthService.applyCondition({
      characterId: 'baby-1',
      type: 'wound',
      severity: 5,
      currentGameDay: 0,
      lifeStage: 'infant',
    });

    expect(listener).not.toHaveBeenCalled();
  });

  // ── Full wound → treatment → recovery timeline ────────────────

  it('wound → treatment → recovery timeline', () => {
    // Day 0: Character receives severity-3 wound
    const wound = svc.healthService.applyCondition({
      characterId: 'hero',
      type: 'wound',
      severity: 3,
      currentGameDay: 0,
    });
    expect(wound).not.toBeNull();
    expect(wound!.resolvesAtDay).toBe(14); // 14-day base duration

    // Day 2: Surgery treatment applied
    const newResolves = svc.healthService.getTreatmentReduction(
      'hero',
      wound!.id,
      'Surgery',
      2,
    );
    // remaining = 12, reduced = round(12 * 0.5) = 6, new resolves = 2 + 6 = 8
    expect(newResolves).toBe(8);

    // Day 5: condition still active
    const prognosisDay5 = svc.healthService.getConditionsWithPrognosis('hero', 5);
    expect(prognosisDay5).toHaveLength(1);
    expect(prognosisDay5[0].remainingDays).toBe(3);
    expect(prognosisDay5[0].isExpired).toBe(false);

    // Day 8: condition expires
    const resolvedCount = svc.healthService.resolveExpiredConditions(8);
    expect(resolvedCount).toBe(1);
    expect(svc.healthService.getConditions('hero')).toHaveLength(0);
  });
});
