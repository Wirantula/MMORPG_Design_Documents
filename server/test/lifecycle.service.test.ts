import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  LifecycleService,
  LIFE_STAGES,
  STAGE_RANGES,
} from '../src/modules/characters/lifecycle/lifecycle.service';
import { FamilyService } from '../src/modules/simulation/family/family.service';
import { DomainEventBus } from '../src/common/domain-events';

// ── Helpers ───────────────────────────────────────────────────────

const GAME_DAYS_PER_YEAR = 365;

function createServices() {
  const eventBus = new DomainEventBus();
  const lifecycleService = new LifecycleService(eventBus);
  const familyService = new FamilyService();
  return { eventBus, lifecycleService, familyService };
}

// ── Life-stage computation ────────────────────────────────────────

describe('LifecycleService – computeLifeStage', () => {
  let svc: ReturnType<typeof createServices>;

  beforeEach(() => {
    svc = createServices();
  });

  it('returns infant for age 0', () => {
    expect(svc.lifecycleService.computeLifeStage(0)).toBe('infant');
  });

  it('returns infant for age 2', () => {
    expect(svc.lifecycleService.computeLifeStage(2)).toBe('infant');
  });

  it('returns child for age 3', () => {
    expect(svc.lifecycleService.computeLifeStage(3)).toBe('child');
  });

  it('returns child for age 9', () => {
    expect(svc.lifecycleService.computeLifeStage(9)).toBe('child');
  });

  it('returns teen for age 10', () => {
    expect(svc.lifecycleService.computeLifeStage(10)).toBe('teen');
  });

  it('returns teen for age 14', () => {
    expect(svc.lifecycleService.computeLifeStage(14)).toBe('teen');
  });

  it('returns adult for age 15', () => {
    expect(svc.lifecycleService.computeLifeStage(15)).toBe('adult');
  });

  it('returns adult for age 45', () => {
    expect(svc.lifecycleService.computeLifeStage(45)).toBe('adult');
  });

  it('returns elder for age 46', () => {
    expect(svc.lifecycleService.computeLifeStage(46)).toBe('elder');
  });

  it('returns elder for age 100', () => {
    expect(svc.lifecycleService.computeLifeStage(100)).toBe('elder');
  });

  it('defines exactly 5 life stages', () => {
    expect(LIFE_STAGES).toHaveLength(5);
    expect(LIFE_STAGES).toEqual(['infant', 'child', 'teen', 'adult', 'elder']);
  });

  it('stage ranges cover ages 0 through Infinity with no gaps', () => {
    expect(STAGE_RANGES[0].minAge).toBe(0);
    for (let i = 1; i < STAGE_RANGES.length; i++) {
      expect(STAGE_RANGES[i].minAge).toBe(STAGE_RANGES[i - 1].maxAge + 1);
    }
    expect(STAGE_RANGES[STAGE_RANGES.length - 1].maxAge).toBe(Infinity);
  });
});

// ── Stage transitions ─────────────────────────────────────────────

describe('LifecycleService – processCharacterLifecycles', () => {
  let svc: ReturnType<typeof createServices>;

  beforeEach(() => {
    svc = createServices();
  });

  it('emits LifeStageTransition when character crosses stage boundary', () => {
    const listener = vi.fn();
    svc.eventBus.on('LifeStageTransition', listener);

    const bornDay = 0;
    svc.lifecycleService.registerCharacter('char-1', bornDay);

    // At day 3*365 the character is age 3 → child
    svc.lifecycleService.processCharacterLifecycles(3 * GAME_DAYS_PER_YEAR);

    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0][0];
    expect(event.type).toBe('LifeStageTransition');
    expect(event.payload.characterId).toBe('char-1');
    expect(event.payload.previousStage).toBe('infant');
    expect(event.payload.newStage).toBe('child');
    expect(event.payload.ageInGameYears).toBe(3);
  });

  it('does not emit event when stage has not changed', () => {
    const listener = vi.fn();
    svc.eventBus.on('LifeStageTransition', listener);

    svc.lifecycleService.registerCharacter('char-1', 0);

    // Still infant at day 1*365 (age 1)
    svc.lifecycleService.processCharacterLifecycles(1 * GAME_DAYS_PER_YEAR);

    expect(listener).not.toHaveBeenCalled();
  });

  it('transitions through all 5 stages over a full lifetime', () => {
    const listener = vi.fn();
    svc.eventBus.on('LifeStageTransition', listener);

    svc.lifecycleService.registerCharacter('char-1', 0);

    // infant → child at age 3
    svc.lifecycleService.processCharacterLifecycles(3 * GAME_DAYS_PER_YEAR);
    // child → teen at age 10
    svc.lifecycleService.processCharacterLifecycles(10 * GAME_DAYS_PER_YEAR);
    // teen → adult at age 15
    svc.lifecycleService.processCharacterLifecycles(15 * GAME_DAYS_PER_YEAR);
    // adult → elder at age 46
    svc.lifecycleService.processCharacterLifecycles(46 * GAME_DAYS_PER_YEAR);

    expect(listener).toHaveBeenCalledTimes(4);

    const stages = listener.mock.calls.map(
      (c: unknown[]) => (c[0] as { payload: { newStage: string } }).payload.newStage,
    );
    expect(stages).toEqual(['child', 'teen', 'adult', 'elder']);
  });

  it('updates the character record stage after transition', () => {
    svc.lifecycleService.registerCharacter('char-1', 0);
    svc.lifecycleService.processCharacterLifecycles(10 * GAME_DAYS_PER_YEAR);

    const record = svc.lifecycleService.getCharacter('char-1');
    expect(record?.currentStage).toBe('teen');
  });
});

// ── Action blocking ───────────────────────────────────────────────

describe('LifecycleService – enforceStageRestrictions', () => {
  let svc: ReturnType<typeof createServices>;

  beforeEach(() => {
    svc = createServices();
  });

  it('blocks dangerous actions for infant characters', () => {
    svc.lifecycleService.registerCharacter('char-1', 0);

    expect(svc.lifecycleService.enforceStageRestrictions('char-1', 'combat')).toBe(true);
    expect(svc.lifecycleService.enforceStageRestrictions('char-1', 'trade')).toBe(true);
    expect(svc.lifecycleService.enforceStageRestrictions('char-1', 'dungeon')).toBe(true);
    expect(svc.lifecycleService.enforceStageRestrictions('char-1', 'pvp')).toBe(true);
    expect(svc.lifecycleService.enforceStageRestrictions('char-1', 'travel_wilderness')).toBe(true);
    expect(svc.lifecycleService.enforceStageRestrictions('char-1', 'contract_sign')).toBe(true);
  });

  it('blocks dangerous actions for child characters', () => {
    svc.lifecycleService.registerCharacter('char-1', 0);
    // Advance to child
    svc.lifecycleService.processCharacterLifecycles(3 * GAME_DAYS_PER_YEAR);

    expect(svc.lifecycleService.enforceStageRestrictions('char-1', 'combat')).toBe(true);
  });

  it('allows dangerous actions for teen characters', () => {
    svc.lifecycleService.registerCharacter('char-1', 0);
    svc.lifecycleService.processCharacterLifecycles(10 * GAME_DAYS_PER_YEAR);

    expect(svc.lifecycleService.enforceStageRestrictions('char-1', 'combat')).toBe(false);
  });

  it('allows dangerous actions for adult characters', () => {
    svc.lifecycleService.registerCharacter('char-1', 0);
    svc.lifecycleService.processCharacterLifecycles(15 * GAME_DAYS_PER_YEAR);

    expect(svc.lifecycleService.enforceStageRestrictions('char-1', 'combat')).toBe(false);
    expect(svc.lifecycleService.enforceStageRestrictions('char-1', 'trade')).toBe(false);
  });

  it('allows safe actions for any stage', () => {
    svc.lifecycleService.registerCharacter('char-1', 0);

    // "socialize" is not in the dangerous set
    expect(svc.lifecycleService.enforceStageRestrictions('char-1', 'socialize')).toBe(false);
    expect(svc.lifecycleService.enforceStageRestrictions('char-1', 'rest')).toBe(false);
  });

  it('returns false for unknown character', () => {
    expect(svc.lifecycleService.enforceStageRestrictions('unknown', 'combat')).toBe(false);
  });
});

// ── Family support ────────────────────────────────────────────────

describe('FamilyService – resolveFamilySupport', () => {
  let svc: ReturnType<typeof createServices>;

  beforeEach(() => {
    svc = createServices();
  });

  it('provides food and shelter for infant characters', () => {
    svc.lifecycleService.registerCharacter('char-1', 0);
    svc.familyService.createFamily('char-1', 0);

    svc.familyService.resolveFamilySupport(1, (id) =>
      svc.lifecycleService.getCharacter(id)?.currentStage,
    );

    const family = svc.familyService.getFamily('char-1');
    expect(family?.householdState.foodSupplied).toBe(true);
    expect(family?.householdState.shelterProvided).toBe(true);
    expect(family?.householdState.lastCheckedGameDay).toBe(1);
  });

  it('provides food and shelter for child characters', () => {
    svc.lifecycleService.registerCharacter('char-1', 0);
    svc.familyService.createFamily('char-1', 0);
    svc.lifecycleService.processCharacterLifecycles(3 * GAME_DAYS_PER_YEAR);

    svc.familyService.resolveFamilySupport(3 * GAME_DAYS_PER_YEAR, (id) =>
      svc.lifecycleService.getCharacter(id)?.currentStage,
    );

    const family = svc.familyService.getFamily('char-1');
    expect(family?.householdState.foodSupplied).toBe(true);
    expect(family?.householdState.shelterProvided).toBe(true);
  });

  it('creates family record with guardian NPC', () => {
    const family = svc.familyService.createFamily('char-1', 0);

    expect(family.familyId).toBe('fam_char-1');
    expect(family.guardianNpcId).toBe('npc_guardian_char-1');
    expect(family.characterId).toBe('char-1');
  });
});

// ── Safety alerts ─────────────────────────────────────────────────

describe('FamilyService – triggerSafetyAlert', () => {
  let svc: ReturnType<typeof createServices>;

  beforeEach(() => {
    svc = createServices();
  });

  it('triggers safety alert on food neglect', () => {
    svc.lifecycleService.registerCharacter('char-1', 0);
    svc.familyService.createFamily('char-1', 0);

    // Simulate neglect before resolve
    svc.familyService.simulateNeglect('char-1', 'food');

    // Manually trigger alert via the public API
    const family = svc.familyService.getFamily('char-1')!;
    const alert = svc.familyService.triggerSafetyAlert(family, 5);

    expect(alert.reason).toBe('food_missing');
    expect(alert.characterId).toBe('char-1');
    expect(alert.gameDay).toBe(5);
  });

  it('triggers safety alert on shelter neglect', () => {
    svc.familyService.createFamily('char-1', 0);
    svc.familyService.simulateNeglect('char-1', 'shelter');

    const family = svc.familyService.getFamily('char-1')!;
    const alert = svc.familyService.triggerSafetyAlert(family, 10);

    expect(alert.reason).toBe('shelter_missing');
  });

  it('triggers safety alert with combined reasons', () => {
    svc.familyService.createFamily('char-1', 0);
    svc.familyService.simulateNeglect('char-1', 'both');

    const family = svc.familyService.getFamily('char-1')!;
    const alert = svc.familyService.triggerSafetyAlert(family, 10);

    expect(alert.reason).toBe('food_missing,shelter_missing');
  });

  it('accumulates alerts in the alerts list', () => {
    svc.familyService.createFamily('char-1', 0);
    svc.familyService.simulateNeglect('char-1', 'food');

    const family = svc.familyService.getFamily('char-1')!;
    svc.familyService.triggerSafetyAlert(family, 5);
    svc.familyService.triggerSafetyAlert(family, 6);

    expect(svc.familyService.getAlerts()).toHaveLength(2);
  });

  it('throws when simulating neglect for unknown character', () => {
    expect(() => svc.familyService.simulateNeglect('unknown', 'food')).toThrow(
      'No family record for unknown',
    );
  });
});

// ── Integration: tick-driven lifecycle + family ───────────────────

describe('Integration – tick lifecycle + family support', () => {
  let svc: ReturnType<typeof createServices>;

  beforeEach(() => {
    svc = createServices();
  });

  it('tutorial prompt fires at each stage transition (event payload includes new stage)', () => {
    const transitions: string[] = [];
    svc.eventBus.on('LifeStageTransition', (event) => {
      const payload = event.payload as { newStage: string };
      transitions.push(payload.newStage);
    });

    svc.lifecycleService.registerCharacter('char-1', 0);

    svc.lifecycleService.processCharacterLifecycles(3 * GAME_DAYS_PER_YEAR);
    svc.lifecycleService.processCharacterLifecycles(10 * GAME_DAYS_PER_YEAR);
    svc.lifecycleService.processCharacterLifecycles(15 * GAME_DAYS_PER_YEAR);
    svc.lifecycleService.processCharacterLifecycles(46 * GAME_DAYS_PER_YEAR);

    // Tutorial prompts can key off these transition events
    expect(transitions).toEqual(['child', 'teen', 'adult', 'elder']);
  });

  it('gameDaysToYears converts correctly', () => {
    expect(svc.lifecycleService.gameDaysToYears(0)).toBe(0);
    expect(svc.lifecycleService.gameDaysToYears(364)).toBe(0);
    expect(svc.lifecycleService.gameDaysToYears(365)).toBe(1);
    expect(svc.lifecycleService.gameDaysToYears(730)).toBe(2);
  });
});
