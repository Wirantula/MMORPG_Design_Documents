import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TickService } from '../src/modules/simulation/tick.service';
import { SimulationService } from '../src/modules/simulation/simulation.service';
import { ActionService } from '../src/modules/simulation/actions/action.service';
import { DomainEventBus } from '../src/common/domain-events';
import { ObservabilityService } from '../src/modules/observability/observability.service';

function createTickService() {
  const eventBus = new DomainEventBus();
  const simulation = new SimulationService({ acceleration: 30 });
  const observability = new ObservabilityService();
  const actionService = new ActionService(eventBus, simulation);
  const tickService = new TickService(eventBus, simulation, actionService, observability);

  // Don't auto-start the loop in tests
  tickService.stopLoop();

  return { tickService, eventBus, simulation, actionService, observability };
}

describe('TickService', () => {
  let svc: ReturnType<typeof createTickService>;

  beforeEach(() => {
    svc = createTickService();
  });

  afterEach(() => {
    svc.tickService.stopLoop();
  });

  it('increments tick count on each tick call', () => {
    svc.tickService.tick();
    svc.tickService.tick();
    svc.tickService.tick();
    expect(svc.tickService.getMetrics().tickCount).toBe(3);
  });

  it('updates currentGameDay metric', () => {
    const nowMs = Date.now();
    svc.tickService.tick(nowMs);
    const day0 = svc.tickService.getMetrics().currentGameDay;

    // Advance one game day in real-time: 86_400_000 / 30 = 2_880_000 ms
    svc.tickService.tick(nowMs + 2_880_000);
    const day1 = svc.tickService.getMetrics().currentGameDay;

    expect(day1).toBe(day0 + 1);
  });

  it('emits TickCompleted domain event on day change', () => {
    const listener = vi.fn();
    svc.eventBus.on('TickCompleted', listener);

    const nowMs = Date.now();
    // First tick sets the baseline day
    svc.tickService.tick(nowMs);
    expect(listener).not.toHaveBeenCalled();

    // Advance past day boundary
    svc.tickService.tick(nowMs + 2_880_000);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].payload.gameDay).toBeGreaterThan(0);
  });

  it('does not emit TickCompleted when day has not changed', () => {
    const listener = vi.fn();
    svc.eventBus.on('TickCompleted', listener);

    const nowMs = Date.now();
    svc.tickService.tick(nowMs);
    svc.tickService.tick(nowMs + 1000); // only 1 second later
    expect(listener).not.toHaveBeenCalled();
  });

  it('pushes simulation metrics to observability service', () => {
    svc.tickService.tick();
    const metrics = svc.observability.getSimulationMetrics();
    expect(metrics.tickCount).toBe(1);
    expect(metrics.lastTickDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('resolves completed actions during tick', () => {
    const nowMs = Date.now();
    svc.actionService.startAction('char-1', 'socialize', nowMs);

    // socialize = 2 game-hours = 7_200_000 world-ms / 30 = 240_000 real-ms
    const futureMs = nowMs + 240_001;
    svc.tickService.tick(futureMs);

    const slot = svc.actionService.getSlot('char-1');
    expect(slot!.state).toBe('completed');
  });

  it('records tick duration', () => {
    svc.tickService.tick();
    const metrics = svc.tickService.getMetrics();
    expect(metrics.lastTickDurationMs).toBeGreaterThanOrEqual(0);
    expect(metrics.maxTickDurationMs).toBeGreaterThanOrEqual(metrics.lastTickDurationMs);
  });
});
