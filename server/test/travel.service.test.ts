import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TravelService, type CargoItem } from '../src/modules/travel/travel.service';
import { WorldService } from '../src/modules/world/world.service';
import { SimulationService } from '../src/modules/simulation/simulation.service';
import { DomainEventBus } from '../src/common/domain-events';
import type { TravelArrived } from '../src/common/domain-events';

// ── Helpers ──────────────────────────────────────────────────────

function createTravelService() {
  const eventBus = new DomainEventBus();
  const worldService = new WorldService();
  const simulation = new SimulationService({ acceleration: 30 });
  const travelService = new TravelService(eventBus, worldService, simulation);

  return { travelService, eventBus, worldService, simulation };
}

/** Convenience: start a journey on the verdant-fields → ironridge edge (15 min, hazard 1). */
function startDefaultJourney(
  svc: ReturnType<typeof createTravelService>,
  cargo: CargoItem[] = [],
  nowMs = Date.now(),
) {
  return svc.travelService.startJourney(
    {
      characterId: 'char-1',
      fromNodeId: 'region-verdant-fields',
      toNodeId: 'region-ironridge',
      cargo,
    },
    nowMs,
  );
}

// ── Tests ────────────────────────────────────────────────────────

describe('TravelService', () => {
  let svc: ReturnType<typeof createTravelService>;

  beforeEach(() => {
    svc = createTravelService();
  });

  // ── Route validation ────────────────────────────────────────

  describe('route validation', () => {
    it('rejects unknown origin node', () => {
      const result = svc.travelService.startJourney({
        characterId: 'char-1',
        fromNodeId: 'nonexistent',
        toNodeId: 'region-ironridge',
        cargo: [],
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rejects unknown destination node', () => {
      const result = svc.travelService.startJourney({
        characterId: 'char-1',
        fromNodeId: 'region-verdant-fields',
        toNodeId: 'nonexistent',
        cargo: [],
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rejects when no edge exists between nodes', () => {
      const result = svc.travelService.startJourney({
        characterId: 'char-1',
        fromNodeId: 'region-ironridge',
        toNodeId: 'region-ashen-coast',
        cargo: [],
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('No route');
    });

    it('starts journey on a valid route', () => {
      const result = startDefaultJourney(svc);
      expect(result.ok).toBe(true);
      expect(result.journey).toBeDefined();
      expect(result.journey!.status).toBe('in_progress');
      expect(result.journey!.fromNodeId).toBe('region-verdant-fields');
      expect(result.journey!.toNodeId).toBe('region-ironridge');
    });
  });

  // ── Travel blocking ─────────────────────────────────────────

  describe('travel blocking', () => {
    it('blocks a second journey while character is travelling', () => {
      const r1 = startDefaultJourney(svc);
      expect(r1.ok).toBe(true);

      const r2 = svc.travelService.startJourney({
        characterId: 'char-1',
        fromNodeId: 'region-verdant-fields',
        toNodeId: 'region-silverwood',
        cargo: [],
      });
      expect(r2.ok).toBe(false);
      expect(r2.error).toContain('already travelling');
    });

    it('allows a new journey after previous one is resolved', () => {
      const nowMs = Date.now();
      startDefaultJourney(svc, [], nowMs);

      // Advance time beyond arrival (15 world-min = 900_000 world-ms / 30 = 30_000 real-ms)
      svc.travelService.resolveArrivals(nowMs + 31_000);

      // Character should be free now
      const r2 = svc.travelService.startJourney(
        {
          characterId: 'char-1',
          fromNodeId: 'region-verdant-fields',
          toNodeId: 'region-silverwood',
          cargo: [],
        },
        nowMs + 32_000,
      );
      expect(r2.ok).toBe(true);
    });

    it('reports isCharacterTravelling correctly', () => {
      expect(svc.travelService.isCharacterTravelling('char-1')).toBe(false);
      startDefaultJourney(svc);
      expect(svc.travelService.isCharacterTravelling('char-1')).toBe(true);
    });
  });

  // ── Hazard roll ─────────────────────────────────────────────

  describe('rollHazard', () => {
    it('returns safe when roll exceeds threshold', () => {
      // hazard_level 5 → threshold 50, roll 80 → safe
      const entry = svc.travelService.rollHazard(5, 0, 80);
      expect(entry.outcome).toBe('safe');
      expect(entry.roll).toBe(80);
    });

    it('returns cargo_loss for low rolls', () => {
      // hazard_level 10 → threshold 100, 30% of 100 = 30, roll 5 → cargo_loss
      const entry = svc.travelService.rollHazard(10, 0, 5);
      expect(entry.outcome).toBe('cargo_loss');
    });

    it('returns delay for mid-range rolls', () => {
      // hazard_level 10 → threshold 100, 30%=30 60%=60, roll 40 → delay
      const entry = svc.travelService.rollHazard(10, 0, 40);
      expect(entry.outcome).toBe('delay');
    });

    it('returns injury for upper hazard rolls', () => {
      // hazard_level 10 → threshold 100, 60%=60, roll 70 → injury
      const entry = svc.travelService.rollHazard(10, 0, 70);
      expect(entry.outcome).toBe('injury');
    });

    it('always returns safe when hazard_level is 0', () => {
      // threshold = 0, any roll > 0 → safe
      const entry = svc.travelService.rollHazard(0, 0, 1);
      expect(entry.outcome).toBe('safe');
    });
  });

  // ── Cargo weight ────────────────────────────────────────────

  describe('computeCargoWeight', () => {
    it('sums item weights', () => {
      const cargo: CargoItem[] = [
        { itemInstanceId: 'i1', weight: 20 },
        { itemInstanceId: 'i2', weight: 35 },
      ];
      expect(svc.travelService.computeCargoWeight(cargo)).toBe(55);
    });

    it('returns 0 for empty cargo', () => {
      expect(svc.travelService.computeCargoWeight([])).toBe(0);
    });
  });

  describe('computeTravelDuration', () => {
    it('returns base duration for weight under threshold', () => {
      // 15 min, 30 kg (under 50 threshold) → 15 * 60_000 = 900_000
      const duration = svc.travelService.computeTravelDuration(15, 30);
      expect(duration).toBe(900_000);
    });

    it('increases duration for weight over threshold', () => {
      // 15 min, 100 kg → 50 kg overweight → penalty = 1 + 50*0.01 = 1.5
      // 900_000 * 1.5 = 1_350_000
      const duration = svc.travelService.computeTravelDuration(15, 100);
      expect(duration).toBe(1_350_000);
    });

    it('applies penalty proportionally', () => {
      const light = svc.travelService.computeTravelDuration(10, 0);
      const heavy = svc.travelService.computeTravelDuration(10, 150);
      expect(heavy).toBeGreaterThan(light);
    });
  });

  describe('cargo weight affects journey arrival time', () => {
    it('heavy cargo extends travel time', () => {
      const nowMs = Date.now();
      const r1 = svc.travelService.startJourney(
        {
          characterId: 'char-1',
          fromNodeId: 'region-verdant-fields',
          toNodeId: 'region-ironridge',
          cargo: [],
        },
        nowMs,
      );

      // Need a second service instance for char-2
      const svc2 = createTravelService();
      const r2 = svc2.travelService.startJourney(
        {
          characterId: 'char-2',
          fromNodeId: 'region-verdant-fields',
          toNodeId: 'region-ironridge',
          cargo: [{ itemInstanceId: 'heavy-box', weight: 200 }],
        },
        nowMs,
      );

      expect(r1.journey!.arrivesAtWorldMs).toBeLessThan(r2.journey!.arrivesAtWorldMs);
    });
  });

  // ── Arrival resolution ──────────────────────────────────────

  describe('resolveArrivals', () => {
    it('resolves journey once arrival time is reached', () => {
      const nowMs = Date.now();
      startDefaultJourney(svc, [], nowMs);

      // Not yet arrived
      const early = svc.travelService.resolveArrivals(nowMs + 10_000);
      expect(early).toHaveLength(0);

      // After arrival (15 min world-time = 900_000 world-ms, at 30x → 30_000 real-ms)
      const late = svc.travelService.resolveArrivals(nowMs + 31_000);
      expect(late).toHaveLength(1);
      expect(late[0].status).toMatch(/arrived|failed/);
    });

    it('does not re-resolve already arrived journeys', () => {
      const nowMs = Date.now();
      startDefaultJourney(svc, [], nowMs);

      svc.travelService.resolveArrivals(nowMs + 31_000);
      const secondPass = svc.travelService.resolveArrivals(nowMs + 32_000);
      expect(secondPass).toHaveLength(0);
    });
  });

  // ── Domain events ───────────────────────────────────────────

  describe('domain events', () => {
    it('emits TravelArrived on journey resolution', () => {
      const listener = vi.fn();
      svc.eventBus.on('TravelArrived', listener);

      const nowMs = Date.now();
      startDefaultJourney(svc, [], nowMs);
      svc.travelService.resolveArrivals(nowMs + 31_000);

      expect(listener).toHaveBeenCalledOnce();
      const event: TravelArrived = listener.mock.calls[0][0];
      expect(event.type).toBe('TravelArrived');
      expect(event.payload.characterId).toBe('char-1');
      expect(event.payload.fromNodeId).toBe('region-verdant-fields');
      expect(event.payload.toNodeId).toBe('region-ironridge');
    });
  });

  // ── Arrival notification ────────────────────────────────────

  describe('arrival notification', () => {
    it('posts notification to character feed on arrival', () => {
      const nowMs = Date.now();
      startDefaultJourney(svc, [], nowMs);

      expect(svc.travelService.getNotifications('char-1')).toHaveLength(0);

      svc.travelService.resolveArrivals(nowMs + 31_000);

      const notifs = svc.travelService.getNotifications('char-1');
      expect(notifs).toHaveLength(1);
      expect(notifs[0].characterId).toBe('char-1');
      expect(notifs[0].message).toContain('region-verdant-fields');
      expect(notifs[0].message).toContain('region-ironridge');
    });

    it('does not post notification for other characters', () => {
      const nowMs = Date.now();
      startDefaultJourney(svc, [], nowMs);
      svc.travelService.resolveArrivals(nowMs + 31_000);

      expect(svc.travelService.getNotifications('char-2')).toHaveLength(0);
    });
  });

  // ── Queries ─────────────────────────────────────────────────

  describe('queries', () => {
    it('getActiveJourneys returns only in_progress journeys', () => {
      const nowMs = Date.now();
      startDefaultJourney(svc, [], nowMs);

      expect(svc.travelService.getActiveJourneys()).toHaveLength(1);

      svc.travelService.resolveArrivals(nowMs + 31_000);
      expect(svc.travelService.getActiveJourneys()).toHaveLength(0);
    });

    it('getJourneysByCharacter returns all journeys for a character', () => {
      const nowMs = Date.now();
      startDefaultJourney(svc, [], nowMs);

      const journeys = svc.travelService.getJourneysByCharacter('char-1');
      expect(journeys).toHaveLength(1);
      expect(journeys[0].characterId).toBe('char-1');
    });
  });
});
