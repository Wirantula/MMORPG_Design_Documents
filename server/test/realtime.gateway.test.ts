import { describe, expect, it, vi } from 'vitest';
import { RealtimeGateway } from '../src/modules/realtime/realtime.gateway';
import { SimulationService } from '../src/modules/simulation/simulation.service';
import { TickService } from '../src/modules/simulation/tick.service';
import { ActionService } from '../src/modules/simulation/actions/action.service';
import { ObservabilityService } from '../src/modules/observability/observability.service';
import { DomainEventBus } from '../src/common/domain-events';
import { AppLogger } from '../src/common/logger.service';
import type { ServerEventEnvelope, AckPayload } from '../src/contracts/message-envelope';
import type { Socket } from 'socket.io';

function createMockSocket() {
  const emittedEvents: Array<{ event: string; data: unknown }> = [];
  return {
    id: 'test-socket-001',
    emit: vi.fn((event: string, data: unknown) => {
      emittedEvents.push({ event, data });
    }),
    _emittedEvents: emittedEvents,
  };
}

function createGateway() {
  const logger = new AppLogger();
  // Suppress log output during tests
  vi.spyOn(logger, 'log').mockImplementation(() => {});
  const eventBus = new DomainEventBus();
  const simulationService = new SimulationService();
  const observability = new ObservabilityService();
  const actionService = new ActionService(eventBus, simulationService);
  const tickService = new TickService(eventBus, simulationService, actionService, observability);
  return new RealtimeGateway(logger, simulationService, tickService, actionService);
}

describe('RealtimeGateway', () => {
  describe('handleCommand', () => {
    it('emits ack and world.snapshot for valid ping', () => {
      const gateway = createGateway();
      const socket = createMockSocket();

      const validCommand = {
        id: 'cmd-001',
        type: 'ping',
        timestamp: '2200-01-01T00:00:00.000Z',
        payload: { nonce: 'abc' },
      };

      gateway.handleCommand(socket as unknown as Socket, validCommand);

      expect(socket.emit).toHaveBeenCalledTimes(2);

      // First call: ack
      const ackCall = socket.emit.mock.calls[0];
      expect(ackCall[0]).toBe('event');
      const ackEnvelope = ackCall[1] as ServerEventEnvelope<AckPayload>;
      expect(ackEnvelope.type).toBe('ack');
      expect(ackEnvelope.id).toBe('cmd-001');
      expect(ackEnvelope.payload.ok).toBe(true);
      expect(ackEnvelope.payload.receivedType).toBe('ping');

      // Second call: world.snapshot
      const snapshotCall = socket.emit.mock.calls[1];
      expect(snapshotCall[0]).toBe('event');
      const snapshotEnvelope = snapshotCall[1] as ServerEventEnvelope;
      expect(snapshotEnvelope.type).toBe('world.snapshot');
      expect(snapshotEnvelope.id).toBe('cmd-001:snapshot');
    });

    it('emits ack for action.submit command', () => {
      const gateway = createGateway();
      const socket = createMockSocket();

      gateway.handleCommand(socket as unknown as Socket, {
        id: 'cmd-002',
        type: 'action.submit',
        timestamp: '2200-01-01T00:00:00.000Z',
        payload: { actionId: 'train_strength' },
      });

      const ackEnvelope = socket.emit.mock.calls[0][1] as ServerEventEnvelope<AckPayload>;
      expect(ackEnvelope.payload.receivedType).toBe('action.submit');
    });

    it('throws on malformed command (missing type)', () => {
      const gateway = createGateway();
      const socket = createMockSocket();

      expect(() =>
        gateway.handleCommand(socket as unknown as Socket, {
          id: 'cmd-003',
          timestamp: '2200-01-01T00:00:00.000Z',
        }),
      ).toThrow();
    });

    it('throws on completely invalid input', () => {
      const gateway = createGateway();
      const socket = createMockSocket();

      expect(() => gateway.handleCommand(socket as unknown as Socket, null)).toThrow();
      expect(() => gateway.handleCommand(socket as unknown as Socket, 'garbage')).toThrow();
      expect(() => gateway.handleCommand(socket as unknown as Socket, 42)).toThrow();
    });
  });

  describe('handleConnection / handleDisconnect', () => {
    it('logs on connection', () => {
      const gateway = createGateway();
      const logger = (gateway as unknown as { logger: AppLogger }).logger;
      const logSpy = vi.spyOn(logger, 'log');

      gateway.handleConnection({ id: 'socket-abc' } as unknown as Socket);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('socket-abc'),
        'RealtimeGateway',
      );
    });

    it('logs on disconnection', () => {
      const gateway = createGateway();
      const logger = (gateway as unknown as { logger: AppLogger }).logger;
      const logSpy = vi.spyOn(logger, 'log');

      gateway.handleDisconnect({ id: 'socket-abc' } as unknown as Socket);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('socket-abc'),
        'RealtimeGateway',
      );
    });
  });
});
