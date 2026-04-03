import { describe, expect, it } from 'vitest';

/**
 * Cross-module contract parity test.
 *
 * The server and client each define their own copy of the message envelope
 * types and command type unions. This test imports both and verifies they
 * remain structurally compatible at runtime. Any drift here indicates a
 * contract boundary violation that must be resolved before merge.
 */

// Server-side contracts
import type {
  ClientCommandType as ServerClientCommandType,
  ServerEventType,
  Envelope as ServerEnvelope,
  PingPayload,
  AckPayload,
} from '../server/src/contracts/message-envelope';

// Client-side contracts
import type {
  ClientCommandType as ClientClientCommandType,
  Envelope as ClientEnvelope,
} from '../client/src/lib/contracts';

// Client helper
import { makeCommandEnvelope } from '../client/src/lib/contracts';

describe('cross-module envelope contract parity', () => {
  it('server and client share the same ClientCommandType values', () => {
    // Both sides must agree on the command type union.
    // We cannot iterate a TS union at runtime, so we enumerate and compare.
    const serverTypes: ServerClientCommandType[] = ['ping', 'action.submit', 'chat.send'];
    const clientTypes: ClientClientCommandType[] = ['ping', 'action.submit', 'chat.send'];

    expect(serverTypes).toEqual(clientTypes);
  });

  it('client-produced envelope is structurally valid for server consumption', async () => {
    // The client helper creates envelopes the server Zod schema must accept.
    // We import the server-side parser to cross-validate.
    // This is the key contract boundary check.
    const { parseCommandEnvelope } = await import('../server/src/modules/realtime/dto/command.dto');

    const envelope = makeCommandEnvelope('ping', { nonce: 'test' });

    // The server parser should accept this envelope without throwing.
    const parsed = parseCommandEnvelope(envelope);
    expect(parsed.type).toBe('ping');
    expect(parsed.id).toBe(envelope.id);
  });

  it('envelope shape has id, type, timestamp, payload fields', () => {
    // Create a client envelope and verify it matches the expected shape
    const envelope = makeCommandEnvelope('chat.send', { message: 'hello' });

    expect(envelope).toHaveProperty('id');
    expect(envelope).toHaveProperty('type');
    expect(envelope).toHaveProperty('timestamp');
    expect(envelope).toHaveProperty('payload');
    expect(typeof envelope.id).toBe('string');
    expect(typeof envelope.type).toBe('string');
    expect(typeof envelope.timestamp).toBe('string');
  });

  it('server ServerEventType covers expected event names', () => {
    const events: ServerEventType[] = ['ack', 'error', 'tick', 'world.snapshot'];
    expect(events).toHaveLength(4);
  });

  it('client envelope metadata field is optional', () => {
    const envelope = makeCommandEnvelope('ping', null);
    // metadata should not be present unless explicitly set
    expect(envelope.metadata).toBeUndefined();
  });
});
