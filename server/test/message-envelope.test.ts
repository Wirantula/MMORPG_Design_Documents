import { describe, expect, it } from 'vitest';
import type {
  ClientCommandType,
  ServerEventType,
  Envelope,
  ClientCommandEnvelope,
  ServerEventEnvelope,
  PingPayload,
  AckPayload,
} from '../src/contracts/message-envelope';

/**
 * These tests validate the shape of the contract types at runtime by
 * constructing compliant objects and asserting their structure.
 * This guards against accidental contract drift.
 */
describe('message-envelope contracts', () => {
  it('ClientCommandEnvelope has required fields', () => {
    const envelope: ClientCommandEnvelope<PingPayload> = {
      id: 'test-id',
      type: 'ping',
      timestamp: new Date().toISOString(),
      payload: { nonce: 'test' },
    };

    expect(envelope).toHaveProperty('id');
    expect(envelope).toHaveProperty('type');
    expect(envelope).toHaveProperty('timestamp');
    expect(envelope).toHaveProperty('payload');
  });

  it('ServerEventEnvelope has required fields', () => {
    const envelope: ServerEventEnvelope<AckPayload> = {
      id: 'test-id',
      type: 'ack',
      timestamp: new Date().toISOString(),
      payload: { ok: true, receivedType: 'ping' },
    };

    expect(envelope).toHaveProperty('id');
    expect(envelope).toHaveProperty('type');
    expect(envelope).toHaveProperty('timestamp');
    expect(envelope).toHaveProperty('payload');
  });

  it('AckPayload contains ok and receivedType', () => {
    const ack: AckPayload = { ok: true, receivedType: 'action.submit' };

    expect(ack.ok).toBe(true);
    expect(ack.receivedType).toBe('action.submit');
  });

  it('Envelope accepts optional metadata', () => {
    const envelope: Envelope<'ack', AckPayload> = {
      id: 'test-id',
      type: 'ack',
      timestamp: new Date().toISOString(),
      payload: { ok: true, receivedType: 'ping' },
      metadata: { source: 'test' },
    };

    expect(envelope.metadata).toEqual({ source: 'test' });
  });

  it('ClientCommandType covers expected command names', () => {
    const commands: ClientCommandType[] = ['ping', 'action.submit', 'chat.send'];
    expect(commands).toHaveLength(3);
  });

  it('ServerEventType covers expected event names', () => {
    const events: ServerEventType[] = ['ack', 'error', 'tick', 'world.snapshot'];
    expect(events).toHaveLength(4);
  });
});
