import { describe, expect, it, vi } from 'vitest';
import { makeCommandEnvelope } from './contracts';

describe('contracts', () => {
  it('creates command envelopes with generated ids', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '00000000-0000-4000-8000-000000000000',
    } satisfies Partial<typeof globalThis.crypto>);

    const envelope = makeCommandEnvelope('ping', { nonce: 'abc' });
    expect(envelope.id).toBe('00000000-0000-4000-8000-000000000000');
    expect(envelope.type).toBe('ping');
    expect(envelope.payload).toEqual({ nonce: 'abc' });
  });
});
