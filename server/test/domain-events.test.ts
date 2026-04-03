import { describe, expect, it, vi } from 'vitest';
import {
  DomainEventBus,
  generateEventId,
  type TickCompleted,
  type ActionSubmitted,
} from '../src/common/domain-events';

describe('DomainEventBus', () => {
  it('delivers events to registered listeners', () => {
    const bus = new DomainEventBus();
    const listener = vi.fn();
    bus.on<TickCompleted>('TickCompleted', listener);

    const event: TickCompleted = {
      eventId: generateEventId(),
      type: 'TickCompleted',
      timestamp: new Date().toISOString(),
      payload: {
        gameDay: 1,
        worldUtc: new Date().toISOString(),
        realtimeUtc: new Date().toISOString(),
        driftMs: 0,
      },
    };

    bus.emit(event);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);
  });

  it('does not deliver events after listener is removed', () => {
    const bus = new DomainEventBus();
    const listener = vi.fn();
    bus.on<TickCompleted>('TickCompleted', listener);
    bus.off<TickCompleted>('TickCompleted', listener);

    bus.emit({
      eventId: generateEventId(),
      type: 'TickCompleted',
      timestamp: new Date().toISOString(),
      payload: { gameDay: 0, worldUtc: '', realtimeUtc: '', driftMs: 0 },
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('isolates events by type', () => {
    const bus = new DomainEventBus();
    const tickListener = vi.fn();
    const actionListener = vi.fn();

    bus.on<TickCompleted>('TickCompleted', tickListener);
    bus.on<ActionSubmitted>('ActionSubmitted', actionListener);

    const actionEvent: ActionSubmitted = {
      eventId: generateEventId(),
      type: 'ActionSubmitted',
      timestamp: new Date().toISOString(),
      payload: {
        characterId: 'char-1',
        definitionId: 'forage',
        startedAtWorldMs: 0,
        endsAtWorldMs: 1000,
      },
    };

    bus.emit(actionEvent);
    expect(tickListener).not.toHaveBeenCalled();
    expect(actionListener).toHaveBeenCalledOnce();
  });

  it('generateEventId returns unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateEventId()));
    expect(ids.size).toBe(100);
  });
});
