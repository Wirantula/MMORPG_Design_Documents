export type ClientCommandType = 'ping' | 'action.submit' | 'action.cancel' | 'chat.send';

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

export interface Envelope<TType extends string, TPayload = unknown> {
  id: string;
  type: TType;
  timestamp: string;
  payload: TPayload;
  metadata?: Record<string, unknown>;
}

export type ClientCommandEnvelope<TPayload = unknown> = Envelope<ClientCommandType, TPayload>;
export type ServerEventEnvelope<TPayload = unknown> = Envelope<ServerEventType, TPayload>;

// ── Server event payloads ───────────────────────────────────────────

export interface CharacterState {
  id: string;
  name: string;
  stage: string;
  stats: Record<string, number>;
  settlement: string;
  node: string;
}

export interface ActionEntry {
  definitionId: string;
  label: string;
  status: 'active' | 'queued' | 'resolved' | 'cancelled';
  startedAtWorldUtc?: string;
  endsAtWorldUtc?: string;
}

export interface ChatMessage {
  channel: string;
  sender: string;
  text: string;
  sentAt: string;
}

export interface NotificationEntry {
  id: string;
  text: string;
  level: 'info' | 'warn' | 'error';
  createdAt: string;
}

export interface WorldSnapshot {
  worldUtc: string;
  realtimeUtc: string;
  acceleration: number;
  actions: ActionEntry[];
}

export function makeCommandEnvelope<TPayload>(
  type: ClientCommandType,
  payload: TPayload,
): ClientCommandEnvelope<TPayload> {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    payload,
  };
}
