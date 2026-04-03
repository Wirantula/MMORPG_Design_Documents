import { describe, expect, it } from 'vitest';
import { parseCommandEnvelope } from '../src/modules/realtime/dto/command.dto';

describe('parseCommandEnvelope', () => {
  const validEnvelope = {
    id: 'cmd-001',
    type: 'ping',
    timestamp: '2200-01-01T00:00:00.000Z',
    payload: { nonce: 'abc' },
  };

  it('accepts a valid ping envelope', () => {
    const result = parseCommandEnvelope(validEnvelope);
    expect(result.id).toBe('cmd-001');
    expect(result.type).toBe('ping');
    expect(result.timestamp).toBe('2200-01-01T00:00:00.000Z');
  });

  it('accepts a valid action.submit envelope', () => {
    const result = parseCommandEnvelope({
      ...validEnvelope,
      type: 'action.submit',
      payload: { actionId: 'gather_wood' },
    });
    expect(result.type).toBe('action.submit');
  });

  it('accepts a valid chat.send envelope', () => {
    const result = parseCommandEnvelope({
      ...validEnvelope,
      type: 'chat.send',
      payload: { message: 'hello world' },
    });
    expect(result.type).toBe('chat.send');
  });

  it('accepts envelope with optional metadata', () => {
    const result = parseCommandEnvelope({
      ...validEnvelope,
      metadata: { source: 'test', version: 1 },
    });
    expect(result.metadata).toEqual({ source: 'test', version: 1 });
  });

  it('accepts envelope without payload', () => {
    const { payload: _, ...withoutPayload } = validEnvelope;
    const result = parseCommandEnvelope(withoutPayload);
    expect(result.payload).toBeUndefined();
  });

  it('rejects envelope with empty id', () => {
    expect(() =>
      parseCommandEnvelope({ ...validEnvelope, id: '' }),
    ).toThrow();
  });

  it('rejects envelope with missing id', () => {
    const { id: _, ...noId } = validEnvelope;
    expect(() => parseCommandEnvelope(noId)).toThrow();
  });

  it('rejects envelope with unknown command type', () => {
    expect(() =>
      parseCommandEnvelope({ ...validEnvelope, type: 'hack.server' }),
    ).toThrow();
  });

  it('rejects envelope with invalid timestamp format', () => {
    expect(() =>
      parseCommandEnvelope({ ...validEnvelope, timestamp: 'not-a-date' }),
    ).toThrow();
  });

  it('rejects envelope with missing timestamp', () => {
    const { timestamp: _, ...noTimestamp } = validEnvelope;
    expect(() => parseCommandEnvelope(noTimestamp)).toThrow();
  });

  it('rejects null input', () => {
    expect(() => parseCommandEnvelope(null)).toThrow();
  });

  it('rejects undefined input', () => {
    expect(() => parseCommandEnvelope(undefined)).toThrow();
  });

  it('rejects non-object input', () => {
    expect(() => parseCommandEnvelope('string')).toThrow();
    expect(() => parseCommandEnvelope(42)).toThrow();
    expect(() => parseCommandEnvelope(true)).toThrow();
  });

  it('rejects array input', () => {
    expect(() => parseCommandEnvelope([validEnvelope])).toThrow();
  });

  it('strips unknown top-level fields (Zod default strip)', () => {
    const result = parseCommandEnvelope({
      ...validEnvelope,
      injectedField: '<script>alert(1)</script>',
    });
    expect((result as Record<string, unknown>).injectedField).toBeUndefined();
  });
});
