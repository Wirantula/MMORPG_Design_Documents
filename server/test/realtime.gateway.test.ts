import { describe, expect, it, vi } from 'vitest';
import { RealtimeGateway } from '../src/modules/realtime/realtime.gateway';
import { SimulationService } from '../src/modules/simulation/simulation.service';
import { AppLogger } from '../src/common/logger.service';
import type { ServerEventEnvelope, AckPayload } from '../src/contracts/message-envelope';

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
  const simulationService = new SimulationService();
  return new RealtimeGateway(logger, simulationService);
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

      gateway.handleCommand(socket as any, validCommand);

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

      gateway.handleCommand(socket as any, {
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
        gateway.handleCommand(socket as any, {
          id: 'cmd-003',
          timestamp: '2200-01-01T00:00:00.000Z',
        }),
      ).toThrow();
    });

    it('throws on completely invalid input', () => {
      const gateway = createGateway();
      const socket = createMockSocket();

      expect(() => gateway.handleCommand(socket as any, null)).toThrow();
      expect(() => gateway.handleCommand(socket as any, 'garbage')).toThrow();
      expect(() => gateway.handleCommand(socket as any, 42)).toThrow();
    });
  });

  describe('handleConnection / handleDisconnect', () => {
    it('logs on connection', () => {
      const gateway = createGateway();
      const logger = (gateway as any).logger as AppLogger;
      const logSpy = vi.spyOn(logger, 'log');

      gateway.handleConnection({ id: 'socket-abc' } as any);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('socket-abc'),
        'RealtimeGateway',
      );
    });

    it('logs on disconnection', () => {
      const gateway = createGateway();
      const logger = (gateway as any).logger as AppLogger;
      const logSpy = vi.spyOn(logger, 'log');

      gateway.handleDisconnect({ id: 'socket-abc' } as any);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('socket-abc'),
        'RealtimeGateway',
      );
    });
  });
});
