import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type TravelArrived,
} from '../../common/domain-events';
import { WorldService, type WorldEdge } from '../world/world.service';
import { SimulationService } from '../simulation/simulation.service';

// ── Types ────────────────────────────────────────────────────────

export type JourneyStatus = 'in_progress' | 'arrived' | 'failed';

export interface CargoItem {
  itemInstanceId: string;
  weight: number;
}

export interface HazardEntry {
  segment: number;
  roll: number;
  outcome: string;
}

export interface TravelJourney {
  id: string;
  characterId: string;
  fromNodeId: string;
  toNodeId: string;
  cargo: CargoItem[];
  status: JourneyStatus;
  startedAtWorldMs: number;
  arrivesAtWorldMs: number;
  hazardLog: HazardEntry[];
}

export interface Notification {
  id: string;
  characterId: string;
  message: string;
  timestamp: string;
}

export interface StartJourneyInput {
  characterId: string;
  fromNodeId: string;
  toNodeId: string;
  cargo: CargoItem[];
}

export interface StartJourneyResult {
  ok: boolean;
  error?: string;
  journey?: TravelJourney;
}

// ── Constants ────────────────────────────────────────────────────

/** Base weight threshold (kg) before penalty kicks in. */
const CARGO_BASE_THRESHOLD = 50;

/** Each kg over threshold adds this fraction to travel time. */
const CARGO_WEIGHT_PENALTY_PER_KG = 0.01;

/** Max hazard roll (d100). */
const HAZARD_ROLL_MAX = 100;

/** Travel time is in world-minutes; convert to world-ms. */
const WORLD_MINUTE_MS = 60_000;

// ── Service ──────────────────────────────────────────────────────

@Injectable()
export class TravelService {
  private readonly logger = new Logger(TravelService.name);
  private readonly journeys = new Map<string, TravelJourney>();
  private readonly notifications: Notification[] = [];

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly worldService: WorldService,
    private readonly simulationService: SimulationService,
  ) {}

  // ── Commands ──────────────────────────────────────────────────

  startJourney(input: StartJourneyInput, nowMs = Date.now()): StartJourneyResult {
    // Block if character already travelling
    if (this.isCharacterTravelling(input.characterId)) {
      return { ok: false, error: 'Character is already travelling' };
    }

    // Validate nodes exist
    const fromNode = this.worldService.getNodeById(input.fromNodeId);
    if (!fromNode) {
      return { ok: false, error: `Origin node ${input.fromNodeId} not found` };
    }
    const toNode = this.worldService.getNodeById(input.toNodeId);
    if (!toNode) {
      return { ok: false, error: `Destination node ${input.toNodeId} not found` };
    }

    // Validate edge exists
    const edge = this.findEdge(input.fromNodeId, input.toNodeId);
    if (!edge) {
      return { ok: false, error: `No route from ${input.fromNodeId} to ${input.toNodeId}` };
    }

    const worldNowMs = this.simulationService.getWorldTimeMs(nowMs);
    const cargoWeight = this.computeCargoWeight(input.cargo);
    const travelWorldMs = this.computeTravelDuration(edge.travel_time_minutes, cargoWeight);

    const journey: TravelJourney = {
      id: generateEventId(),
      characterId: input.characterId,
      fromNodeId: input.fromNodeId,
      toNodeId: input.toNodeId,
      cargo: [...input.cargo],
      status: 'in_progress',
      startedAtWorldMs: worldNowMs,
      arrivesAtWorldMs: worldNowMs + travelWorldMs,
      hazardLog: [],
    };

    this.journeys.set(journey.id, journey);

    this.logger.log(
      JSON.stringify({
        event: 'travel_journey_started',
        journey_id: journey.id,
        character_id: input.characterId,
        from: input.fromNodeId,
        to: input.toNodeId,
        cargo_weight: cargoWeight,
        travel_world_ms: travelWorldMs,
      }),
      'TravelService',
    );

    return { ok: true, journey };
  }

  // ── Tick resolution ───────────────────────────────────────────

  /**
   * Called each tick to resolve arrivals. Returns journeys that arrived this tick.
   */
  resolveArrivals(nowMs = Date.now()): TravelJourney[] {
    const worldNowMs = this.simulationService.getWorldTimeMs(nowMs);
    const arrived: TravelJourney[] = [];

    for (const journey of this.journeys.values()) {
      if (journey.status !== 'in_progress') continue;
      if (worldNowMs < journey.arrivesAtWorldMs) continue;

      // Roll hazards
      const edge = this.findEdge(journey.fromNodeId, journey.toNodeId);
      const hazardLevel = edge?.hazard_level ?? 0;
      const hazardEntry = this.rollHazard(hazardLevel, journey.hazardLog.length);
      journey.hazardLog.push(hazardEntry);

      // Apply cargo loss if hazard outcome is 'cargo_loss'
      const cargoLost: string[] = [];
      if (hazardEntry.outcome === 'cargo_loss' && journey.cargo.length > 0) {
        const lostItem = journey.cargo.splice(
          Math.floor(Math.random() * journey.cargo.length),
          1,
        )[0];
        if (lostItem) cargoLost.push(lostItem.itemInstanceId);
      }

      journey.status = hazardEntry.outcome === 'failure' ? 'failed' : 'arrived';

      // Post notification
      const notifMessage = journey.status === 'arrived'
        ? `Arrived at destination from ${journey.fromNodeId} to ${journey.toNodeId}.${
            cargoLost.length > 0 ? ` Lost cargo: ${cargoLost.join(', ')}.` : ''
          }${hazardEntry.outcome !== 'safe' ? ` Hazard: ${hazardEntry.outcome}.` : ''}`
        : `Travel from ${journey.fromNodeId} to ${journey.toNodeId} failed due to hazard.`;

      this.postNotification(journey.characterId, notifMessage, nowMs);

      // Emit domain event
      const event: TravelArrived = {
        eventId: generateEventId(),
        type: 'TravelArrived',
        timestamp: new Date(nowMs).toISOString(),
        payload: {
          journeyId: journey.id,
          characterId: journey.characterId,
          fromNodeId: journey.fromNodeId,
          toNodeId: journey.toNodeId,
          cargoLost,
          hazardLog: journey.hazardLog,
          arrivedAtWorldMs: journey.arrivesAtWorldMs,
        },
      };
      this.eventBus.emit(event);

      this.logger.log(
        JSON.stringify({
          event: 'travel_journey_resolved',
          journey_id: journey.id,
          character_id: journey.characterId,
          status: journey.status,
          hazard_outcome: hazardEntry.outcome,
          cargo_lost: cargoLost,
        }),
        'TravelService',
      );

      arrived.push(journey);
    }

    return arrived;
  }

  // ── Hazard system ─────────────────────────────────────────────

  /**
   * Roll a hazard check. hazardLevel 0-10 maps to a % chance of encounter.
   * Returns a HazardEntry describing what happened.
   */
  rollHazard(hazardLevel: number, segment = 0, roll?: number): HazardEntry {
    const actualRoll = roll ?? Math.floor(Math.random() * HAZARD_ROLL_MAX) + 1;
    const threshold = hazardLevel * 10; // hazard 5 → 50% chance

    if (actualRoll > threshold) {
      return { segment, roll: actualRoll, outcome: 'safe' };
    }

    // Within the hazard zone, determine severity
    if (actualRoll <= threshold * 0.3) {
      return { segment, roll: actualRoll, outcome: 'cargo_loss' };
    }
    if (actualRoll <= threshold * 0.6) {
      return { segment, roll: actualRoll, outcome: 'delay' };
    }
    return { segment, roll: actualRoll, outcome: 'injury' };
  }

  // ── Cargo weight ──────────────────────────────────────────────

  /** Total weight of cargo items in kg. */
  computeCargoWeight(cargo: CargoItem[]): number {
    return cargo.reduce((sum, item) => sum + item.weight, 0);
  }

  /** Travel duration in world-ms, accounting for cargo weight penalty. */
  computeTravelDuration(baseTravelMinutes: number, cargoWeight: number): number {
    const baseMs = baseTravelMinutes * WORLD_MINUTE_MS;
    const overweight = Math.max(0, cargoWeight - CARGO_BASE_THRESHOLD);
    const penalty = 1 + overweight * CARGO_WEIGHT_PENALTY_PER_KG;
    return Math.ceil(baseMs * penalty);
  }

  // ── Queries ───────────────────────────────────────────────────

  isCharacterTravelling(characterId: string): boolean {
    for (const j of this.journeys.values()) {
      if (j.characterId === characterId && j.status === 'in_progress') return true;
    }
    return false;
  }

  getActiveJourneys(): TravelJourney[] {
    const result: TravelJourney[] = [];
    for (const j of this.journeys.values()) {
      if (j.status === 'in_progress') result.push(j);
    }
    return result;
  }

  getJourneysByCharacter(characterId: string): TravelJourney[] {
    const result: TravelJourney[] = [];
    for (const j of this.journeys.values()) {
      if (j.characterId === characterId) result.push(j);
    }
    return result;
  }

  getNotifications(characterId: string): Notification[] {
    return this.notifications.filter((n) => n.characterId === characterId);
  }

  // ── Internal helpers ──────────────────────────────────────────

  private findEdge(fromId: string, toId: string): WorldEdge | undefined {
    return this.worldService
      .getOutgoingConnections(fromId)
      .find((e) => e.to_node_id === toId);
  }

  private postNotification(characterId: string, message: string, nowMs: number): void {
    this.notifications.push({
      id: generateEventId(),
      characterId,
      message,
      timestamp: new Date(nowMs).toISOString(),
    });
  }
}
