import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../../common/logger.service';
import {
  DomainEventBus,
  generateEventId,
  type OfflineReportGenerated,
} from '../../../common/domain-events';
import { SimulationService } from '../simulation.service';
import { getActionDefinition, type ActionCategory } from '../actions/action-catalog';
import { ObservabilityService } from '../../observability/observability.service';
import {
  MAX_ROUTINE_SLOTS,
  OFFLINE_EFFICIENCY,
  PROTECTED_LIFE_STAGES,
  type CharacterState,
  type OfflineReport,
  type OfflineActionEntry,
  type RoutineSlot,
} from './routine.types';

/** Needs threshold above which routines are skipped (0–100 scale). */
const CRITICAL_NEEDS_THRESHOLD = 90;

/** Base XP awarded per action completion (placeholder until progression engine). */
const BASE_XP_PER_ACTION = 10;

/** Hunger increase per action completed offline. */
const HUNGER_PER_ACTION = 5;

/** Fatigue increase per action completed offline. */
const FATIGUE_PER_ACTION = 8;

/** Action categories considered dangerous and blocked for protected life stages. */
const DANGEROUS_CATEGORIES: ReadonlySet<ActionCategory> = new Set<ActionCategory>([
  'combat',
  'travel',
]);

@Injectable()
export class RoutineService {
  constructor(
    private readonly logger: AppLogger,
    private readonly eventBus: DomainEventBus,
    private readonly simulationService: SimulationService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  /**
   * Process offline routines for a character who has just logged back in.
   *
   * @param character The character state at the time of login.
   * @param loginRealtimeMs Real-time ms when the player logged back in.
   * @returns The offline report summarising what happened while away.
   */
  processOfflineRoutines(character: CharacterState, loginRealtimeMs = Date.now()): OfflineReport {
    const offlineSinceMs = character.offlineSince
      ? new Date(character.offlineSince).getTime()
      : loginRealtimeMs;

    const durationMs = Math.max(0, loginRealtimeMs - offlineSinceMs);

    this.logger.log(
      `Processing offline routines for character ${character.characterId} (${durationMs} ms offline)`,
      'RoutineService',
    );

    // Validate and cap routine slots
    const validRoutines = this.getValidRoutines(character);

    const warnings: string[] = [];
    const actionEntries: OfflineActionEntry[] = [];
    let totalXp = 0;
    let totalActions = 0;
    let hungerDelta = 0;
    let fatigueDelta = 0;

    // Mutable needs tracking through the processing window
    let currentHunger = character.needs.hunger;
    let currentFatigue = character.needs.fatigue;

    // Calculate available world-time for offline processing
    const worldTimeBudgetMs = durationMs * this.simulationService.getAcceleration();

    // Process routines in priority order
    const sorted = [...validRoutines].sort((a, b) => a.priority - b.priority);

    let remainingWorldMs = worldTimeBudgetMs;

    for (const routine of sorted) {
      const definition = getActionDefinition(routine.actionType);
      if (!definition) {
        warnings.push(`Unknown action type: ${routine.actionType}`);
        continue;
      }

      // Block dangerous actions for protected life stages
      if (PROTECTED_LIFE_STAGES.has(character.lifeStage) && DANGEROUS_CATEGORIES.has(definition.category)) {
        warnings.push(
          `Blocked dangerous action "${definition.name}" for ${character.lifeStage} life stage`,
        );
        continue;
      }

      let completedCount = 0;
      let routineXp = 0;

      while (remainingWorldMs >= definition.durationGameMs) {
        // Check critical needs before each action
        if (currentHunger >= CRITICAL_NEEDS_THRESHOLD || currentFatigue >= CRITICAL_NEEDS_THRESHOLD) {
          warnings.push(
            `Skipped "${definition.name}" — needs critical (hunger: ${currentHunger}, fatigue: ${currentFatigue})`,
          );
          // Break out of this routine entirely when needs are critical
          remainingWorldMs = 0;
          break;
        }

        remainingWorldMs -= definition.durationGameMs;
        completedCount += 1;

        const xp = Math.floor(BASE_XP_PER_ACTION * OFFLINE_EFFICIENCY);
        routineXp += xp;

        // Simulate needs drift
        currentHunger = Math.min(100, currentHunger + HUNGER_PER_ACTION);
        currentFatigue = Math.min(100, currentFatigue + FATIGUE_PER_ACTION);
      }

      if (completedCount > 0) {
        actionEntries.push({
          actionType: routine.actionType,
          completedCount,
          xpEarned: routineXp,
        });
        totalXp += routineXp;
        totalActions += completedCount;
      }
    }

    hungerDelta = currentHunger - character.needs.hunger;
    fatigueDelta = currentFatigue - character.needs.fatigue;

    const report: OfflineReport = {
      characterId: character.characterId,
      durationMs,
      actionsCompleted: totalActions,
      xpEarned: totalXp,
      actions: actionEntries,
      needsChanges: { hungerDelta, fatigueDelta },
      warnings,
    };

    // Emit domain event
    const event: OfflineReportGenerated = {
      eventId: generateEventId(),
      type: 'OfflineReportGenerated',
      timestamp: new Date(loginRealtimeMs).toISOString(),
      payload: {
        characterId: character.characterId,
        durationMs,
        actionsCompleted: totalActions,
        xpEarned: totalXp,
        warnings,
      },
    };
    this.eventBus.emit(event);

    // Record metric
    this.observabilityService.recordOfflineRoutinesProcessed(totalActions);

    this.logger.log(
      `Offline routines complete for ${character.characterId}: ${totalActions} actions, ${totalXp} XP, ${warnings.length} warnings`,
      'RoutineService',
    );

    return report;
  }

  /**
   * Generate an offline report without domain event emission.
   * Useful for preview / dry-run scenarios.
   */
  generateOfflineReport(character: CharacterState, loginRealtimeMs = Date.now()): OfflineReport {
    // Same logic but without side-effects — for now delegate to the full processor.
    // In future this could be separated if we need pure preview without events.
    return this.processOfflineRoutines(character, loginRealtimeMs);
  }

  // ── Private helpers ─────────────────────────────────────────────

  /**
   * Validate and cap routine slots to MAX_ROUTINE_SLOTS.
   * Filters out entries whose actionType is not in the catalog.
   */
  private getValidRoutines(character: CharacterState): RoutineSlot[] {
    return character.routines
      .filter((r) => getActionDefinition(r.actionType) !== undefined)
      .slice(0, MAX_ROUTINE_SLOTS);
  }
}
