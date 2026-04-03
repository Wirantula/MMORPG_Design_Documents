import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type TickCompleted,
} from '../../common/domain-events';
import { SimulationService } from './simulation.service';
import { ActionService } from './actions/action.service';
import { ObservabilityService } from '../observability/observability.service';
import type { LifecycleService } from '../characters/lifecycle/lifecycle.service';
import type { FamilyService } from './family/family.service';
import type { NeedsService } from '../needs/needs.service';
import type { HealthService } from '../health/health.service';

/** Minimal interface so TickService can call matchOrders without a hard import cycle. */
export interface OrderMatcher {
  matchOrders(currentGameDay: number): number;
}

/** Minimal interface so TickService can resolve travel arrivals without a hard import cycle. */
export interface TravelResolver {
  resolveArrivals(nowMs: number): unknown[];
}
export interface TickMetrics {
  tickCount: number;
  lastTickDurationMs: number;
  maxTickDurationMs: number;
  currentGameDay: number;
  driftMs: number;
}

@Injectable()
export class TickService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TickService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private lastGameDay = -1;

  private _tickCount = 0;
  private _lastTickDurationMs = 0;
  private _maxTickDurationMs = 0;
  private _currentGameDay = 0;
  private _driftMs = 0;
  private _lastTickExpectedMs = 0;

  private orderMatcher: OrderMatcher | null = null;
  private travelResolver: TravelResolver | null = null;
  private lifecycleService: LifecycleService | null = null;
  private familyService: FamilyService | null = null;
  private needsService: NeedsService | null = null;
  private healthService: HealthService | null = null;

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly simulationService: SimulationService,
    private readonly actionService: ActionService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  /** Injected after bootstrap so there's no hard dependency. */
  setLifecycleService(service: LifecycleService): void {
    this.lifecycleService = service;
  }

  /** Injected after bootstrap so there's no hard dependency. */
  setFamilyService(service: FamilyService): void {
    this.familyService = service;
  }

  /** Injected after bootstrap so there's no hard dependency. */
  setNeedsService(service: NeedsService): void {
    this.needsService = service;
  }

  /** Injected after bootstrap so there's no hard dependency. */
  setHealthService(service: HealthService): void {
    this.healthService = service;
  }
  /** Injected by EconomyModule after bootstrap so there's no hard dependency. */
  setOrderMatcher(matcher: OrderMatcher): void {
    this.orderMatcher = matcher;
  }

  /** Injected by TravelModule after bootstrap so there's no hard dependency. */
  setTravelResolver(resolver: TravelResolver): void {
    this.travelResolver = resolver;
  }
  onModuleInit(): void {
    // Validate all constructor-injected dependencies before starting the loop.
    // If any are undefined, DI failed silently (e.g. a module re-registered
    // DomainEventBus, breaking the SharedModule @Global() singleton).
    // Log clearly so the root cause can be diagnosed immediately.
    const missing = [
      ['simulationService', this.simulationService],
      ['actionService', this.actionService],
      ['eventBus', this.eventBus],
      ['observabilityService', this.observabilityService],
    ]
      .filter(([, v]) => v === undefined || v === null)
      .map(([k]) => k as string);

    if (missing.length > 0) {
      this.logger.error(
        `TickService: DI FAILED — the following dependencies are undefined: ${missing.join(', ')}. ` +
          'Check that no module re-declares DomainEventBus in its own providers ' +
          '(see AGENTS.md CRITICAL NestJS DI RULE).',
        'TickService',
      );
      // Do not start the loop — a broken tick is worse than no tick.
      return;
    }

    // Default 2 s — overridable via startLoop for testing.
    this.startLoop(2000);
  }

  onModuleDestroy(): void {
    this.stopLoop();
  }

  startLoop(intervalMs: number): void {
    this.stopLoop();
    this._lastTickExpectedMs = Date.now();
    this.intervalHandle = setInterval(() => {
      this._lastTickExpectedMs += intervalMs;
      this.tick();
    }, intervalMs);
    this.logger.log(`Tick loop started (${intervalMs} ms cadence)`, 'TickService');
  }

  stopLoop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Execute a single simulation tick. Public so tests can call it directly.
   */
  tick(nowMs = Date.now()): void {
    // Null-guard: if DI failed on startup, abort gracefully instead of crashing.
    if (!this.simulationService || !this.actionService || !this.observabilityService) {
      return;
    }

    const tickStart = performance.now();

    const gameDay = this.simulationService.getGameDayNumber(nowMs);
    this._currentGameDay = gameDay;

    // Resolve completed actions
    this.actionService.tickActions(nowMs);

    // Run market order matching
    if (this.orderMatcher) {
      this.orderMatcher.matchOrders(gameDay);
    }

    // Resolve travel arrivals
    if (this.travelResolver) {
      this.travelResolver.resolveArrivals(nowMs);
    }
    // Detect day change
    const dayChanged = gameDay !== this.lastGameDay && this.lastGameDay >= 0;
    this.lastGameDay = gameDay;

    if (dayChanged) {
      // Process life-stage transitions
      if (this.lifecycleService) {
        this.lifecycleService.processCharacterLifecycles(gameDay);
      }

      // Resolve family NPC support for protected characters
      if (this.familyService && this.lifecycleService) {
        const lc = this.lifecycleService;
        this.familyService.resolveFamilySupport(
          gameDay,
          (characterId: string) => lc.getCharacter(characterId)?.currentStage,
        );
      }

      // Decay character needs daily
      if (this.needsService) {
        this.needsService.decayNeeds(gameDay);
      }

      // Resolve expired health conditions
      if (this.healthService) {
        this.healthService.resolveExpiredConditions(gameDay);
      }
      const snapshot = this.simulationService.getWorldSnapshot(nowMs);
      const event: TickCompleted = {
        eventId: generateEventId(),
        type: 'TickCompleted',
        timestamp: new Date(nowMs).toISOString(),
        payload: {
          gameDay,
          worldUtc: snapshot.worldUtc,
          realtimeUtc: snapshot.realtimeUtc,
          driftMs: this._driftMs,
        },
      };
      this.eventBus.emit(event);
      this.logger.log(
        `Game day ${gameDay} completed (drift ${this._driftMs} ms)`,
        'TickService',
      );
    }

    // Metrics bookkeeping
    const tickDuration = performance.now() - tickStart;
    this._tickCount += 1;
    this._lastTickDurationMs = tickDuration;
    if (tickDuration > this._maxTickDurationMs) {
      this._maxTickDurationMs = tickDuration;
    }
    this._driftMs = nowMs - this._lastTickExpectedMs;

    // Push simulation metrics to observability
    this.observabilityService.recordSimulationMetrics({
      tickCount: this._tickCount,
      lastTickDurationMs: this._lastTickDurationMs,
      maxTickDurationMs: this._maxTickDurationMs,
      currentGameDay: this._currentGameDay,
      driftMs: this._driftMs,
    });
  }

  getMetrics(): TickMetrics {
    return {
      tickCount: this._tickCount,
      lastTickDurationMs: this._lastTickDurationMs,
      maxTickDurationMs: this._maxTickDurationMs,
      currentGameDay: this._currentGameDay,
      driftMs: this._driftMs,
    };
  }
}
