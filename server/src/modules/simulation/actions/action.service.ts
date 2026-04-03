import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type ActionSubmitted,
  type ActionResolved,
  type ActionCancelled,
} from '../../../common/domain-events';
import { SimulationService } from '../simulation.service';
import { getActionDefinition } from './action-catalog';
import { ActionQueue, type ActionSlot } from './action-queue';
import type { NeedsService } from '../../needs/needs.service';

export interface ActionResult {
  ok: boolean;
  error?: string;
  slot?: ActionSlot;
}

@Injectable()
export class ActionService {
  private readonly logger = new Logger(ActionService.name);
  private readonly queue = new ActionQueue();
  private needsService: NeedsService | null = null;

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly simulationService: SimulationService,
  ) {}

  /** Injected after bootstrap so there's no hard dependency. */
  setNeedsService(service: NeedsService): void {
    this.needsService = service;
  }

  // ── Commands ──────────────────────────────────────────────────

  startAction(characterId: string, definitionId: string, nowMs = Date.now()): ActionResult {
    const definition = getActionDefinition(definitionId);
    if (!definition) {
      return { ok: false, error: `Unknown action definition: ${definitionId}` };
    }

    const existing = this.queue.get(characterId);
    if (existing && (existing.state === 'active' || existing.state === 'paused')) {
      return { ok: false, error: 'Character already has an active or paused action' };
    }

    const worldNowMs = this.simulationService.getWorldTimeMs(nowMs);
    const slot: ActionSlot = {
      characterId,
      definitionId,
      state: 'active',
      startedAtWorldMs: worldNowMs,
      endsAtWorldMs: worldNowMs + definition.durationGameMs,
      elapsedBeforePauseMs: 0,
    };

    this.queue.set(characterId, slot);

    const event: ActionSubmitted = {
      eventId: generateEventId(),
      type: 'ActionSubmitted',
      timestamp: new Date(nowMs).toISOString(),
      payload: {
        characterId,
        definitionId,
        startedAtWorldMs: slot.startedAtWorldMs,
        endsAtWorldMs: slot.endsAtWorldMs,
      },
    };
    this.eventBus.emit(event);
    this.logger.log(
      `Action started: ${definitionId} for character ${characterId}`,
      'ActionService',
    );

    return { ok: true, slot };
  }

  cancelAction(characterId: string, nowMs = Date.now()): ActionResult {
    const slot = this.queue.get(characterId);
    if (!slot || (slot.state !== 'active' && slot.state !== 'paused')) {
      return { ok: false, error: 'No active or paused action to cancel' };
    }

    slot.state = 'cancelled';
    const worldNowMs = this.simulationService.getWorldTimeMs(nowMs);

    const event: ActionCancelled = {
      eventId: generateEventId(),
      type: 'ActionCancelled',
      timestamp: new Date(nowMs).toISOString(),
      payload: {
        characterId,
        definitionId: slot.definitionId,
        cancelledAtWorldMs: worldNowMs,
      },
    };
    this.eventBus.emit(event);
    this.logger.log(
      `Action cancelled: ${slot.definitionId} for character ${characterId}`,
      'ActionService',
    );

    return { ok: true, slot };
  }

  pauseAction(characterId: string, nowMs = Date.now()): ActionResult {
    const slot = this.queue.get(characterId);
    if (!slot || slot.state !== 'active') {
      return { ok: false, error: 'No active action to pause' };
    }

    const worldNowMs = this.simulationService.getWorldTimeMs(nowMs);
    slot.elapsedBeforePauseMs += worldNowMs - slot.startedAtWorldMs;
    slot.pausedAtWorldMs = worldNowMs;
    slot.state = 'paused';

    this.logger.log(
      `Action paused: ${slot.definitionId} for character ${characterId}`,
      'ActionService',
    );

    return { ok: true, slot };
  }

  resumeAction(characterId: string, nowMs = Date.now()): ActionResult {
    const slot = this.queue.get(characterId);
    if (!slot || slot.state !== 'paused') {
      return { ok: false, error: 'No paused action to resume' };
    }

    const worldNowMs = this.simulationService.getWorldTimeMs(nowMs);
    const definition = getActionDefinition(slot.definitionId);
    if (!definition) {
      return { ok: false, error: `Action definition not found: ${slot.definitionId}` };
    }

    const remainingMs = definition.durationGameMs - slot.elapsedBeforePauseMs;
    slot.startedAtWorldMs = worldNowMs;
    slot.endsAtWorldMs = worldNowMs + remainingMs;
    slot.pausedAtWorldMs = undefined;
    slot.state = 'active';

    this.logger.log(
      `Action resumed: ${slot.definitionId} for character ${characterId}`,
      'ActionService',
    );

    return { ok: true, slot };
  }

  // ── Tick processing ───────────────────────────────────────────

  /**
   * Called once per tick to resolve any actions whose end time has passed.
   * Returns the list of slots that were completed this tick.
   */
  tickActions(nowMs = Date.now()): ActionSlot[] {
    const worldNowMs = this.simulationService.getWorldTimeMs(nowMs);
    const completed: ActionSlot[] = [];

    for (const slot of this.queue.allInState('active')) {
      if (worldNowMs >= slot.endsAtWorldMs) {
        slot.state = 'completed';

        // Apply needs-based modifier to action rewards
        const needsModifier = this.needsService
          ? this.needsService.getModifier(slot.characterId)
          : 1.0;

        const event: ActionResolved = {
          eventId: generateEventId(),
          type: 'ActionResolved',
          timestamp: new Date(nowMs).toISOString(),
          payload: {
            characterId: slot.characterId,
            definitionId: slot.definitionId,
            completedAtWorldMs: slot.endsAtWorldMs,
            rewards: { needsModifier },
          },
        };
        this.eventBus.emit(event);
        this.logger.log(
          `Action resolved: ${slot.definitionId} for character ${slot.characterId}`,
          'ActionService',
        );
        completed.push(slot);
      }
    }

    return completed;
  }

  // ── Queries ───────────────────────────────────────────────────

  getSlot(characterId: string): ActionSlot | undefined {
    return this.queue.get(characterId);
  }

  getActiveCount(): number {
    return this.queue.allInState('active').length;
  }
}
