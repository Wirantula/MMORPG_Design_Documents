export type ClientCommandType = 'ping' | 'action.submit' | 'chat.send';
export type ServerEventType = 'ack' | 'error' | 'tick' | 'world.snapshot';

export interface Envelope<TType extends string, TPayload = unknown> {
  id: string;
  type: TType;
  timestamp: string;
  payload: TPayload;
  metadata?: Record<string, unknown>;
}

export type ClientCommandEnvelope<TPayload = unknown> = Envelope<ClientCommandType, TPayload>;
export type ServerEventEnvelope<TPayload = unknown> = Envelope<ServerEventType, TPayload>;

export interface PingPayload {
  nonce?: string;
}

export interface AckPayload {
  ok: true;
  receivedType: ClientCommandType;
}
