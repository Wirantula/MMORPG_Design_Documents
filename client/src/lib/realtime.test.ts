import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { RealtimeClient } from './realtime';
import type { ClientCommandEnvelope } from './contracts';

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  url: string;
  listeners: Map<string, Function[]> = new Map();
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(event: string, handler: Function) {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }
}

describe('RealtimeClient', () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    (globalThis as any).WebSocket = originalWebSocket;
  });

  it('creates a WebSocket on connect', () => {
    const client = new RealtimeClient();
    const onMessage = vi.fn();

    client.connect(onMessage);

    // Access internal socket to verify connection
    const socket = (client as any).socket as MockWebSocket;
    expect(socket).toBeInstanceOf(MockWebSocket);
    expect(socket.url).toContain('/ws');
  });

  it('registers message listener on connect', () => {
    const client = new RealtimeClient();
    const onMessage = vi.fn();

    client.connect(onMessage);

    const socket = (client as any).socket as MockWebSocket;
    const listeners = socket.listeners.get('message') ?? [];
    expect(listeners.length).toBe(1);
  });

  it('closes socket and nullifies on disconnect', () => {
    const client = new RealtimeClient();
    client.connect(vi.fn());

    const socket = (client as any).socket as MockWebSocket;
    expect(socket).not.toBeNull();

    client.disconnect();

    expect((client as any).socket).toBeNull();
    expect(socket.readyState).toBe(MockWebSocket.CLOSED);
  });

  it('disconnect is safe to call when not connected', () => {
    const client = new RealtimeClient();
    expect(() => client.disconnect()).not.toThrow();
  });

  it('sends JSON-serialized envelope via sendCommand', () => {
    const client = new RealtimeClient();
    client.connect(vi.fn());

    const envelope: ClientCommandEnvelope = {
      id: 'test-id',
      type: 'ping',
      timestamp: new Date().toISOString(),
      payload: { nonce: 'abc' },
    };

    client.sendCommand(envelope);

    const socket = (client as any).socket as MockWebSocket;
    expect(socket.sentMessages.length).toBe(1);

    const sent = JSON.parse(socket.sentMessages[0]);
    expect(sent.event).toBe('command');
    expect(sent.data.id).toBe('test-id');
    expect(sent.data.type).toBe('ping');
  });

  it('throws if sendCommand called before connect', () => {
    const client = new RealtimeClient();

    const envelope: ClientCommandEnvelope = {
      id: 'test-id',
      type: 'ping',
      timestamp: new Date().toISOString(),
      payload: null,
    };

    expect(() => client.sendCommand(envelope)).toThrow('not connected');
  });

  it('throws if sendCommand called after disconnect', () => {
    const client = new RealtimeClient();
    client.connect(vi.fn());
    client.disconnect();

    const envelope: ClientCommandEnvelope = {
      id: 'test-id',
      type: 'ping',
      timestamp: new Date().toISOString(),
      payload: null,
    };

    expect(() => client.sendCommand(envelope)).toThrow('not connected');
  });
});
