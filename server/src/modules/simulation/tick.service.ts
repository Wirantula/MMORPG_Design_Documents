import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type TickCompleted,
} from '../../common/domain-events';
import { SimulationService } from './simulation.service';
import { ActionService } from './actions/action.service';
import { ObservabilityService } from '../observability/observability.service';
import type { ServerEventEnvelope } from '../../contracts/message-envelope';
import type { Server } from 'socket.io';

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
  private wsServer: Server | null = null;

  private _tickCount = 0;
  private _lastTickDurationMs = 0;
  private _maxTickDurationMs = 0;
  private _currentGameDay = 0;
  private _driftMs = 0;
  private _lastTickExpectedMs = 0;

  private orderMatcher: OrderMatcher | null = null;
  private travelResolver: TravelResolver | null = null;

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly simulationService: SimulationService,
    private readonly actionService: ActionService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  /** Injected by EconomyModule after bootstrap so there's no hard dependency. */
  setOrderMatcher(matcher: OrderMatcher): void {
    this.orderMatcher = matcher;
  }

  /** Injected by TravelModule after bootstrap so there's no hard dependency. */
  setTravelResolver(resolver: TravelResolver): void {
    this.travelResolver = resolver;
  }

  /** Called by RealtimeGateway once the WS server is ready. */
  setWsServer(server: Server): void {
    this.wsServer = server;
  }

  onModuleInit(): void {
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

    // Broadcast tick to connected WS clients
    if (this.wsServer) {
      const snapshot = this.simulationService.getWorldSnapshot(nowMs);
      const tickEvent: ServerEventEnvelope = {
        id: generateEventId(),
        type: 'tick',
        timestamp: new Date(nowMs).toISOString(),
        payload: snapshot,
      };
      this.wsServer.emit('event', tickEvent);
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
