import { readRuntimeConfig } from './config';
import type { ClientCommandEnvelope } from './contracts';

// ── Server event types the shell cares about ────────────────────────
export type ServerEventType =
  | 'ack'
  | 'error'
  | 'tick'
  | 'world.snapshot'
  | 'character.update'
  | 'action.started'
  | 'action.resolved'
  | 'action.cancelled'
  | 'chat.message'
  | 'notification';

export interface ServerEventEnvelope<TPayload = unknown> {
  id: string;
  type: ServerEventType;
  timestamp: string;
  payload: TPayload;
  metadata?: Record<string, unknown>;
}

// ── Typed event map for the emitter ─────────────────────────────────
export interface WsClientEventMap {
  open: void;
  close: { code: number; reason: string };
  error: Event;
  message: ServerEventEnvelope;
}

type Listener<T> = (data: T) => void;

// ── Reconnect constants ─────────────────────────────────────────────
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;
const BACKOFF_FACTOR = 2;

/**
 * Singleton WebSocket client with typed event emitter and exponential
 * backoff reconnect.  Designed for browser-only usage (Next.js client).
 */
export class WsClient {
  // ── Singleton ─────────────────────────────────────────────────────
  private static instance: WsClient | null = null;

  static getInstance(): WsClient {
    if (!WsClient.instance) {
      WsClient.instance = new WsClient();
    }
    return WsClient.instance;
  }

  /** Resets the singleton — useful in tests. */
  static resetInstance(): void {
    WsClient.instance?.dispose();
    WsClient.instance = null;
  }

  // ── Internal state ────────────────────────────────────────────────
  private socket: WebSocket | null = null;
  private listeners = new Map<keyof WsClientEventMap, Set<Listener<unknown>>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private disposed = false;
  private shouldReconnect = true;

  private constructor() {}

  // ── Public API ────────────────────────────────────────────────────

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(): void {
    if (this.disposed) return;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

    const { wsBaseUrl } = readRuntimeConfig();
    console.log(`[WsClient] connecting to ${wsBaseUrl}`);

    this.shouldReconnect = true;
    this.socket = new WebSocket(wsBaseUrl);

    this.socket.addEventListener('open', () => {
      this.attempt = 0;
      console.log('[WsClient] connected');
      this.emit('open', undefined as never);
    });

    this.socket.addEventListener('close', (ev) => {
      console.log(`[WsClient] disconnected code=${ev.code} reason=${ev.reason}`);
      this.emit('close', { code: ev.code, reason: ev.reason });
      this.scheduleReconnect();
    });

    this.socket.addEventListener('error', (ev) => {
      console.error('[WsClient] error', ev);
      this.emit('error', ev);
    });

    this.socket.addEventListener('message', (ev: MessageEvent<string>) => {
      try {
        const envelope = JSON.parse(ev.data) as ServerEventEnvelope;
        this.emit('message', envelope);
      } catch {
        console.warn('[WsClient] failed to parse message', ev.data);
      }
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnect();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.disconnect();
    this.listeners.clear();
  }

  sendCommand<TPayload>(envelope: ClientCommandEnvelope<TPayload>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected.');
    }
    this.socket.send(JSON.stringify({ event: 'command', data: envelope }));
  }

  // ── Typed event emitter ───────────────────────────────────────────

  on<K extends keyof WsClientEventMap>(event: K, fn: Listener<WsClientEventMap[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as Listener<unknown>);
    return () => set!.delete(fn as Listener<unknown>);
  }

  off<K extends keyof WsClientEventMap>(event: K, fn: Listener<WsClientEventMap[K]>): void {
    this.listeners.get(event)?.delete(fn as Listener<unknown>);
  }

  // ── Internals ─────────────────────────────────────────────────────

  private emit<K extends keyof WsClientEventMap>(event: K, data: WsClientEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        (fn as Listener<WsClientEventMap[K]>)(data);
      } catch (err) {
        console.error(`[WsClient] listener error for "${event}"`, err);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || !this.shouldReconnect) return;

    const delay = Math.min(BASE_DELAY_MS * BACKOFF_FACTOR ** this.attempt, MAX_DELAY_MS);
    this.attempt++;

    console.log(`[WsClient] reconnecting in ${delay}ms (attempt ${this.attempt})`);
    this.reconnectTimer = setTimeout(() => {
      this.socket = null;
      this.connect();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
