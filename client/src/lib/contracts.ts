export type ClientCommandType = 'ping' | 'action.submit' | 'chat.send';

export interface Envelope<TType extends string, TPayload = unknown> {
  id: string;
  type: TType;
  timestamp: string;
  payload: TPayload;
  metadata?: Record<string, unknown>;
}

export type ClientCommandEnvelope<TPayload = unknown> = Envelope<ClientCommandType, TPayload>;

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
