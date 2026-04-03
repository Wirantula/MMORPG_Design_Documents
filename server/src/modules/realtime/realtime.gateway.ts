import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SimulationService } from '../simulation/simulation.service';
import { ActionService } from '../simulation/actions/action.service';
import { AuthService } from '../auth/auth.service';
import { parseCommandEnvelope } from './dto/command.dto';
import {
  DomainEventBus,
  generateEventId,
  type ConnectionEstablished,
  type ConnectionClosed,
} from '../../common/domain-events';
import type {
  AckPayload,
  ActionStartedPayload,
  ActionCancelledPayload,
  ChatMessagePayload,
  ServerEventEnvelope,
} from '../../contracts/message-envelope';

/** Heartbeat ping interval in ms. */
const HEARTBEAT_INTERVAL_MS = 30_000;
/** Max time to wait for a pong response before disconnecting. */
const PONG_TIMEOUT_MS = 10_000;
@WebSocketGateway({
  path: '/ws',
  cors: {
    origin: true,
    credentials: true,
  },
  pingInterval: HEARTBEAT_INTERVAL_MS,
  pingTimeout: PONG_TIMEOUT_MS,
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  /** Map of socket.id → authenticated account ID. */
  private readonly socketToAccount = new Map<string, string>();
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly simulationService: SimulationService,
    private readonly actionService: ActionService,
    private readonly authService: AuthService,
    private readonly eventBus: DomainEventBus,
  ) {}

  handleConnection(client: Socket): void {
    // Extract JWT from handshake query param "auth"
    const token =
      (client.handshake?.query?.['auth'] as string | undefined) ??
      (client.handshake?.auth?.['token'] as string | undefined);

    if (!token) {
      this.logger.warn(`Connection rejected (no token): ${client.id}`, 'RealtimeGateway');
      client.emit('event', {
        id: `sys:auth-error:${client.id}`,
        type: 'error',
        timestamp: new Date().toISOString(),
        payload: { message: 'Authentication required' },
      } satisfies ServerEventEnvelope);
      client.disconnect(true);
      return;
    }

    const accountId = this.authService.verifyAccessToken(token);
    if (!accountId) {
      this.logger.warn(`Connection rejected (invalid JWT): ${client.id}`, 'RealtimeGateway');
      client.emit('event', {
        id: `sys:auth-error:${client.id}`,
        type: 'error',
        timestamp: new Date().toISOString(),
        payload: { message: 'Invalid or expired token' },
      } satisfies ServerEventEnvelope);
      client.disconnect(true);
      return;
    }

    // Authenticated — register mapping
    this.socketToAccount.set(client.id, accountId);

    // Emit domain event
    const event: ConnectionEstablished = {
      eventId: generateEventId(),
      type: 'ConnectionEstablished',
      timestamp: new Date().toISOString(),
      payload: { accountId, socketId: client.id },
    };
    this.eventBus.emit(event);

    this.logger.log(
      `ConnectionEstablished: account=${accountId} socket=${client.id} connected_clients=${this.socketToAccount.size}`,
      'RealtimeGateway',
    );
  }

  handleDisconnect(client: Socket): void {
    const accountId = this.socketToAccount.get(client.id);
    this.socketToAccount.delete(client.id);

    const reason = accountId ? 'client_disconnect' : 'unauthenticated';

    if (accountId) {
      const event: ConnectionClosed = {
        eventId: generateEventId(),
        type: 'ConnectionClosed',
        timestamp: new Date().toISOString(),
        payload: { accountId, socketId: client.id, reason },
      };
      this.eventBus.emit(event);
    }

    this.logger.log(
      `ConnectionClosed: account=${accountId ?? 'unknown'} socket=${client.id} reason=${reason} connected_clients=${this.socketToAccount.size}`,
      'RealtimeGateway',
    );
  }

  // ── Observability helpers ───────────────────────────────────────────

  /** Current number of authenticated connections. */
  get connectedClientsCount(): number {
    return this.socketToAccount.size;
  }

  /** Get the account ID for a given socket, if authenticated. */
  getAccountId(socketId: string): string | undefined {
    return this.socketToAccount.get(socketId);
  }

  // ── Broadcast helpers (server → all clients) ───────────────────

  broadcastWorldTick(payload: unknown): void {
    this.server?.emit('event', {
      id: `sys:tick:${Date.now()}`,
      type: 'tick',
      timestamp: new Date().toISOString(),
      payload,
    } satisfies ServerEventEnvelope);
  }

  broadcastCharacterUpdate(characterId: string, changes: Record<string, unknown>): void {
    this.server?.emit('event', {
      id: `sys:character.update:${Date.now()}`,
      type: 'character.update',
      timestamp: new Date().toISOString(),
      payload: { characterId, changes },
    } satisfies ServerEventEnvelope);
  }

  sendNotification(socketId: string, title: string, body: string, category?: string): void {
    const socket = this.server?.sockets?.sockets?.get(socketId);
    socket?.emit('event', {
      id: `sys:notification.new:${Date.now()}`,
      type: 'notification.new',
      timestamp: new Date().toISOString(),
      payload: { targetAccountId: this.socketToAccount.get(socketId) ?? '', title, body, category },
    } satisfies ServerEventEnvelope);
  }

  broadcastChatMessage(senderId: string, channel: string, message: string): void {
    this.server?.emit('event', {
      id: `sys:chat.message:${Date.now()}`,
      type: 'chat.message',
      timestamp: new Date().toISOString(),
      payload: { senderId, channel, message } satisfies ChatMessagePayload,
    } satisfies ServerEventEnvelope<ChatMessagePayload>);
  }

  // ── Client commands ────────────────────────────────────────
  @SubscribeMessage('command')
  handleCommand(@ConnectedSocket() client: Socket, @MessageBody() rawPayload: unknown) {
    const payload = parseCommandEnvelope(rawPayload);
    const nowMs = Date.now();
    const accountId = this.socketToAccount.get(client.id);

    // Reject commands from unauthenticated sockets (shouldn't happen if
    // handleConnection works, but defence-in-depth).
    if (!accountId) {
      client.emit('event', {
        id: `${payload.id}:error`,
        type: 'error',
        timestamp: new Date(nowMs).toISOString(),
        payload: { message: 'Not authenticated' },
      } satisfies ServerEventEnvelope);
      return;
    }

    // Send ack for every command
    const ack: ServerEventEnvelope<AckPayload> = {
      id: payload.id,
      type: 'ack',
      timestamp: new Date(nowMs).toISOString(),
      payload: {
        ok: true,
        receivedType: payload.type,
      },
    };
    client.emit('event', ack);

    // Route by command type
    switch (payload.type) {
      case 'action.submit': {
        const body = payload.payload as { characterId?: string; definitionId?: string } | undefined;
        const characterId = body?.characterId ?? client.id;
        const definitionId = body?.definitionId;
        if (!definitionId) {
          client.emit('event', {
            id: `${payload.id}:error`,
            type: 'error',
            timestamp: new Date(nowMs).toISOString(),
            payload: { message: 'Missing definitionId in action.submit payload' },
          } satisfies ServerEventEnvelope);
          return;
        }

        const result = this.actionService.startAction(characterId, definitionId, nowMs);
        if (!result.ok) {
          client.emit('event', {
            id: `${payload.id}:error`,
            type: 'error',
            timestamp: new Date(nowMs).toISOString(),
            payload: { message: result.error },
          } satisfies ServerEventEnvelope);
          return;
        }

        const slot = result.slot!;
        client.emit('event', {
          id: `${payload.id}:action.started`,
          type: 'action.started',
          timestamp: new Date(nowMs).toISOString(),
          payload: {
            characterId: slot.characterId,
            definitionId: slot.definitionId,
            startedAtWorldUtc: new Date(slot.startedAtWorldMs).toISOString(),
            endsAtWorldUtc: new Date(slot.endsAtWorldMs).toISOString(),
          } satisfies ActionStartedPayload,
        } satisfies ServerEventEnvelope<ActionStartedPayload>);
        return;
      }

      case 'action.cancel': {
        const body = payload.payload as { characterId?: string } | undefined;
        const characterId = body?.characterId ?? client.id;
        const result = this.actionService.cancelAction(characterId, nowMs);
        if (!result.ok) {
          client.emit('event', {
            id: `${payload.id}:error`,
            type: 'error',
            timestamp: new Date(nowMs).toISOString(),
            payload: { message: result.error },
          } satisfies ServerEventEnvelope);
          return;
        }

        const slot = result.slot!;
        client.emit('event', {
          id: `${payload.id}:action.cancelled`,
          type: 'action.cancelled',
          timestamp: new Date(nowMs).toISOString(),
          payload: {
            characterId: slot.characterId,
            definitionId: slot.definitionId,
            cancelledAtWorldUtc: new Date(nowMs).toISOString(),
          } satisfies ActionCancelledPayload,
        } satisfies ServerEventEnvelope<ActionCancelledPayload>);
        return;
      }

      case 'chat.send': {
        const body = payload.payload as { channel?: string; message?: string } | undefined;
        const channel = body?.channel ?? 'global';
        const message = body?.message ?? '';
        if (!message) {
          client.emit('event', {
            id: `${payload.id}:error`,
            type: 'error',
            timestamp: new Date(nowMs).toISOString(),
            payload: { message: 'Empty chat message' },
          } satisfies ServerEventEnvelope);
          return;
        }

        this.broadcastChatMessage(accountId, channel, message);
        return;
      }

      case 'character.get': {
        const body = payload.payload as { characterId?: string } | undefined;
        const characterId = body?.characterId ?? client.id;
        // Return current world snapshot scoped to this character
        client.emit('event', {
          id: `${payload.id}:character.update`,
          type: 'character.update',
          timestamp: new Date(nowMs).toISOString(),
          payload: { characterId, changes: this.simulationService.getWorldSnapshot(nowMs) },
        } satisfies ServerEventEnvelope);
        return;
      }
      default: {
        // Ping and other commands get a world snapshot
        client.emit('event', {
          id: `${payload.id}:snapshot`,
          type: 'world.snapshot',
          timestamp: new Date(nowMs).toISOString(),
          payload: this.simulationService.getWorldSnapshot(nowMs),
        } satisfies ServerEventEnvelope);
      }
    }
  }
}
