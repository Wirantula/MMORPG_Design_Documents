import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { WsClient, type ServerEventEnvelope } from './ws-client';

// ── Mock WebSocket ──────────────────────────────────────────────────

type WsListener = (...args: unknown[]) => void;

class MockWebSocket {
  static CONNECTING = 0 as const;
  static OPEN = 1 as const;
  static CLOSING = 2 as const;
  static CLOSED = 3 as const;

  readyState: number = MockWebSocket.CONNECTING;
  url: string;
  private listeners = new Map<string, WsListener[]>();
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    // Auto-open after microtask — can be suppressed per-test via autoOpen flag
    if (autoOpen) {
      queueMicrotask(() => this.simulateOpen());
    }
  }

  addEventListener(event: string, handler: WsListener) {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.fire('close', { code: 1000, reason: '' });
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.fire('open', {});
  }

  simulateMessage(data: unknown) {
    this.fire('message', { data: JSON.stringify(data) } as MessageEvent<string>);
  }

  simulateClose(code = 1006, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    this.fire('close', { code, reason });
  }

  simulateError() {
    this.fire('error', new Event('error'));
  }

  private fire(event: string, data: unknown) {
    for (const fn of this.listeners.get(event) ?? []) {
      fn(data);
    }
  }
}

// Capture each constructed MockWebSocket so tests can interact with it.
let lastCreatedSocket: MockWebSocket | null = null;
let autoOpen = true;
function MockWebSocketCtor(url: string) {
  const sock = new MockWebSocket(url);
  lastCreatedSocket = sock;
  return sock;
}
// Give it the static constants the code may check
Object.assign(MockWebSocketCtor, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
});

// ── Tests ───────────────────────────────────────────────────────────

describe('WsClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocketCtor);
    lastCreatedSocket = null;
    autoOpen = true;
    WsClient.resetInstance();
  });

  afterEach(() => {
    WsClient.resetInstance();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ── Singleton ───────────────────────────────────────────────────

  it('returns the same instance from getInstance()', () => {
    const a = WsClient.getInstance();
    const b = WsClient.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance() creates a fresh instance', () => {
    const a = WsClient.getInstance();
    WsClient.resetInstance();
    const b = WsClient.getInstance();
    expect(a).not.toBe(b);
  });

  // ── Connect / Disconnect ────────────────────────────────────────

  it('creates a WebSocket on connect()', async () => {
    const ws = WsClient.getInstance();
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    expect(lastCreatedSocket).not.toBeNull();
    expect(lastCreatedSocket!.url).toContain('/ws');
  });

  it('emits open event on connection', async () => {
    const ws = WsClient.getInstance();
    const onOpen = vi.fn();
    ws.on('open', onOpen);
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(ws.connected).toBe(true);
  });

  it('disconnect() closes the socket', async () => {
    const ws = WsClient.getInstance();
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    ws.disconnect();
    expect(ws.connected).toBe(false);
  });

  // ── Reconnect with exponential backoff ──────────────────────────

  it('schedules reconnect on unexpected close', async () => {
    const ws = WsClient.getInstance();
    const onClose = vi.fn();
    ws.on('close', onClose);
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    const sock = lastCreatedSocket!;
    // Simulate unexpected close (not via disconnect())
    sock.simulateClose(1006, 'gone');

    expect(onClose).toHaveBeenCalledWith({ code: 1006, reason: 'gone' });

    // First reconnect after BASE_DELAY (500ms)
    await vi.advanceTimersByTimeAsync(500);
    // A new socket should have been created
    expect(lastCreatedSocket).not.toBe(sock);
  });

  it('uses exponential backoff delays', async () => {
    const ws = WsClient.getInstance();
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    // Suppress auto-open for reconnected sockets so attempt counter is not reset
    autoOpen = false;

    // Close #1 → delay = 500 * 2^0 = 500ms (attempt 0)
    lastCreatedSocket!.simulateClose(1006);
    await vi.advanceTimersByTimeAsync(499);
    const socketAfterFirstClose = lastCreatedSocket;
    // Should NOT have reconnected yet at 499ms
    await vi.advanceTimersByTimeAsync(1);
    const socketAfterFirstReconnect = lastCreatedSocket;
    expect(socketAfterFirstReconnect).not.toBe(socketAfterFirstClose);

    // Close #2 → delay = 500 * 2^1 = 1000ms (attempt 1)
    lastCreatedSocket!.simulateClose(1006);
    const socketBeforeSecondReconnect = lastCreatedSocket;
    await vi.advanceTimersByTimeAsync(999);
    expect(lastCreatedSocket).toBe(socketBeforeSecondReconnect);
    await vi.advanceTimersByTimeAsync(1);
    expect(lastCreatedSocket).not.toBe(socketBeforeSecondReconnect);
  });

  it('does not reconnect after explicit disconnect()', async () => {
    const ws = WsClient.getInstance();
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    const sock = lastCreatedSocket!;
    ws.disconnect();

    // Advance far past any backoff
    await vi.advanceTimersByTimeAsync(60_000);
    // No new socket should be created
    expect(lastCreatedSocket).toBe(sock);
  });

  // ── Event emitter ───────────────────────────────────────────────

  it('routes parsed messages to "message" listeners', async () => {
    const ws = WsClient.getInstance();
    const onMsg = vi.fn();
    ws.on('message', onMsg);
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    const envelope: ServerEventEnvelope = {
      id: 'e1',
      type: 'character.update',
      timestamp: new Date().toISOString(),
      payload: { name: 'Kira' },
    };
    lastCreatedSocket!.simulateMessage(envelope);

    expect(onMsg).toHaveBeenCalledTimes(1);
    expect(onMsg).toHaveBeenCalledWith(expect.objectContaining({ type: 'character.update' }));
  });

  it('on() returns an unsubscribe function', async () => {
    const ws = WsClient.getInstance();
    const onMsg = vi.fn();
    const unsub = ws.on('message', onMsg);
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    unsub();

    const envelope: ServerEventEnvelope = {
      id: 'e2',
      type: 'tick',
      timestamp: new Date().toISOString(),
      payload: {},
    };
    lastCreatedSocket!.simulateMessage(envelope);

    expect(onMsg).not.toHaveBeenCalled();
  });

  it('off() removes a listener', async () => {
    const ws = WsClient.getInstance();
    const onMsg = vi.fn();
    ws.on('message', onMsg);
    ws.off('message', onMsg);
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    lastCreatedSocket!.simulateMessage({ id: 'x', type: 'tick', timestamp: '', payload: {} });

    expect(onMsg).not.toHaveBeenCalled();
  });

  // ── sendCommand ─────────────────────────────────────────────────

  it('sends JSON envelope via sendCommand', async () => {
    const ws = WsClient.getInstance();
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    ws.sendCommand({ id: 'c1', type: 'ping', timestamp: '', payload: { nonce: 'x' } });

    const sent = JSON.parse(lastCreatedSocket!.sentMessages[0]);
    expect(sent.event).toBe('command');
    expect(sent.data.type).toBe('ping');
  });

  it('throws when sendCommand called while disconnected', () => {
    const ws = WsClient.getInstance();
    expect(() =>
      ws.sendCommand({ id: 'c1', type: 'ping', timestamp: '', payload: null }),
    ).toThrow('not connected');
  });
});
