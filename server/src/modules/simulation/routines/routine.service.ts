import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type OfflineReportGenerated,
} from '../../../common/domain-events';
import { SimulationService } from '../simulation.service';
import { ObservabilityService } from '../../observability/observability.service';
import { getActionDefinition } from '../actions/action-catalog';
import {
  DANGEROUS_CATEGORIES,
  MAX_ROUTINE_SLOTS,
  NEEDS_CRITICAL_THRESHOLD,
  OFFLINE_EFFICIENCY,
  type CharacterOfflineState,
  type OfflineReport,
  type OfflineReportEntry,
  type RoutineSlot,
} from './routine.types';

/**
 * Base XP reward per action completion (placeholder until the
 * progression engine in Epic 6 fills in real values).
 */
const BASE_XP_PER_ACTION = 10;

/**
 * Per-tick hunger/fatigue decay per action execution cycle (world-time).
 * Purely illustrative until the needs system (Story 7.1) lands.
 */
const NEEDS_DECAY_PER_ACTION = 2;

@Injectable()
export class RoutineService {
  /** In-memory per-character offline state. Will move to persistence later. */
  private readonly offlineStates = new Map<string, CharacterOfflineState>();

  private readonly logger = new Logger(RoutineService.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly simulationService: SimulationService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  // ── Routine management ──────────────────────────────────────────

  /**
   * Set routines for a character (max 3 slots).
   * Slots are sorted by priority (ascending = highest first).
   */
  setRoutines(characterId: string, routines: RoutineSlot[]): { ok: boolean; error?: string } {
    if (routines.length > MAX_ROUTINE_SLOTS) {
      return { ok: false, error: `Cannot exceed ${MAX_ROUTINE_SLOTS} routine slots` };
    }

    // Validate each routine references a known action
    for (const slot of routines) {
      if (!getActionDefinition(slot.actionType)) {
        return { ok: false, error: `Unknown action type: ${slot.actionType}` };
      }
    }

    const state = this.offlineStates.get(characterId);
    if (state) {
      state.routines = [...routines].sort((a, b) => a.priority - b.priority);
    }
    // If character isn't tracked yet, routines are stored on next goOffline call
    return { ok: true };
  }

  /**
   * Mark a character as going offline and store their state snapshot.
   */
  goOffline(state: CharacterOfflineState): void {
    // Enforce max slots
    const routines = state.routines
      .slice(0, MAX_ROUTINE_SLOTS)
      .sort((a, b) => a.priority - b.priority);

    this.offlineStates.set(state.characterId, { ...state, routines });

    this.logger.log(
      `Character ${state.characterId} went offline with ${routines.length} routine(s)`,
      'RoutineService',
    );
  }

  /**
   * Process offline routines and generate a report on login.
   * Returns `undefined` if the character has no offline state.
   */
  processLogin(characterId: string, loginRealtimeMs = Date.now()): OfflineReport | undefined {
    const state = this.offlineStates.get(characterId);
    if (!state) {
      return undefined;
    }

    const report = this.processOfflineRoutines(state, loginRealtimeMs);
    this.offlineStates.delete(characterId);

    // Emit domain event
    const event: OfflineReportGenerated = {
      eventId: generateEventId(),
      type: 'OfflineReportGenerated',
      timestamp: new Date(loginRealtimeMs).toISOString(),
      payload: {
        characterId,
        offlineDurationMs: report.offlineDurationMs,
        actionsCompleted: report.actionsCompleted.reduce((sum, e) => sum + e.timesCompleted, 0),
        totalXpEarned: report.totalXpEarned,
        warnings: report.warnings,
      },
    };
    this.eventBus.emit(event);

    // Observability
    this.observabilityService.recordOfflineRoutinesProcessed(1);

    this.logger.log(
      `Offline report generated for ${characterId}: ${report.actionsCompleted.length} action type(s), ` +
        `${report.totalXpEarned} XP, ${report.warnings.length} warning(s)`,
      'RoutineService',
    );

    return report;
  }

  // ── Core offline processing ─────────────────────────────────────

  /**
   * Simulate the offline period by iterating through routine slots in
   * priority order, resolving actions, and applying the 60 % efficiency
   * penalty.
   */
  processOfflineRoutines(state: CharacterOfflineState, loginRealtimeMs: number): OfflineReport {
    const offlineDurationMs = loginRealtimeMs - state.offlineSinceMs;
    const acceleration = this.simulationService.getAcceleration();
    const worldDurationMs = offlineDurationMs * acceleration;

    const warnings: string[] = [];
    const entriesMap = new Map<string, OfflineReportEntry>();

    let worldTimeConsumedMs = 0;
    const needs = { ...state.needs };

    // Sort routines by priority (lowest number = highest priority)
    const sortedRoutines = [...state.routines].sort((a, b) => a.priority - b.priority);

    // Keep cycling through routines while there is world-time remaining
    let iterationGuard = 0;
    const MAX_ITERATIONS = 10_000; // safety valve

    while (worldTimeConsumedMs < worldDurationMs && iterationGuard < MAX_ITERATIONS) {
      iterationGuard += 1;
      let madeProgress = false;

      for (const routine of sortedRoutines) {
        if (worldTimeConsumedMs >= worldDurationMs) break;

        const definition = getActionDefinition(routine.actionType);
        if (!definition) continue;

        // Safety check: block dangerous actions for infant/child
        if (
          DANGEROUS_CATEGORIES.has(definition.category) &&
          (state.lifeStage === 'infant' || state.lifeStage === 'child')
        ) {
          const warnMsg = `Blocked dangerous action "${routine.actionType}" for ${state.lifeStage} character`;
          if (!warnings.includes(warnMsg)) {
            warnings.push(warnMsg);
          }
          continue;
        }

        // Skip if needs are critical
        if (needs.hunger <= NEEDS_CRITICAL_THRESHOLD || needs.fatigue <= NEEDS_CRITICAL_THRESHOLD) {
          const warnMsg = 'Routine processing paused: needs are critical';
          if (!warnings.includes(warnMsg)) {
            warnings.push(warnMsg);
          }
          break; // stop all processing when needs are critical
        }

        // Check if there's enough world-time left for this action
        if (worldTimeConsumedMs + definition.durationGameMs > worldDurationMs) {
          continue; // try next routine — it might be shorter
        }

        // Execute action
        worldTimeConsumedMs += definition.durationGameMs;
        const xpEarned = Math.floor(BASE_XP_PER_ACTION * OFFLINE_EFFICIENCY);

        const entry = entriesMap.get(routine.actionType);
        if (entry) {
          entry.timesCompleted += 1;
          entry.xpEarned += xpEarned;
        } else {
          entriesMap.set(routine.actionType, {
            actionType: routine.actionType,
            timesCompleted: 1,
            xpEarned,
          });
        }

        // Apply needs decay
        needs.hunger = Math.max(0, needs.hunger - NEEDS_DECAY_PER_ACTION);
        needs.fatigue = Math.max(0, needs.fatigue - NEEDS_DECAY_PER_ACTION);

        madeProgress = true;
      }

      // If no routine could execute this cycle, break to avoid infinite loop
      if (!madeProgress) break;
    }

    const actionsCompleted = [...entriesMap.values()];
    const totalXpEarned = actionsCompleted.reduce((sum, e) => sum + e.xpEarned, 0);

    return {
      characterId: state.characterId,
      offlineDurationMs,
      worldDurationMs,
      actionsCompleted,
      totalXpEarned,
      needsChanges: {
        hungerDelta: needs.hunger - state.needs.hunger,
        fatigueDelta: needs.fatigue - state.needs.fatigue,
      },
      warnings,
    };
  }

  // ── Queries ────────────────────────────────────────────────────

  getOfflineState(characterId: string): CharacterOfflineState | undefined {
    return this.offlineStates.get(characterId);
  }

  isOffline(characterId: string): boolean {
    return this.offlineStates.has(characterId);
  }
}
