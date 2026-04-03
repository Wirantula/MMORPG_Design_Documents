export type ClientCommandType = 'ping' | 'action.submit' | 'action.cancel' | 'chat.send';
export type ServerEventType =
  | 'ack'
  | 'error'
  | 'tick'
  | 'world.snapshot'
  | 'action.started'
  | 'action.resolved'
  | 'action.cancelled';

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

export interface ActionStartedPayload {
  characterId: string;
  definitionId: string;
  startedAtWorldUtc: string;
  endsAtWorldUtc: string;
}

export interface ActionResolvedPayload {
  characterId: string;
  definitionId: string;
  completedAtWorldUtc: string;
  rewards: Record<string, unknown>;
}

export interface ActionCancelledPayload {
  characterId: string;
  definitionId: string;
  cancelledAtWorldUtc: string;
}
