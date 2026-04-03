import { Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SimulationService } from '../simulation/simulation.service';
import { TickService } from '../simulation/tick.service';
import { ActionService } from '../simulation/actions/action.service';
import { parseCommandEnvelope } from './dto/command.dto';
import type {
  AckPayload,
  ActionStartedPayload,
  ActionCancelledPayload,
  ServerEventEnvelope,
} from '../../contracts/message-envelope';

@WebSocketGateway({
  path: '/ws',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly simulationService: SimulationService,
    private readonly actionService: ActionService,
  ) {}

  afterInit(server: Server): void {
    // Use ModuleRef to resolve TickService lazily after all modules are
    // fully initialised, avoiding scope resolution races.
    const tickService = this.moduleRef.get(TickService, { strict: false });
    tickService?.setWsServer(server);
    this.logger.log('WebSocket server initialised', 'RealtimeGateway');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`, 'RealtimeGateway');
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`, 'RealtimeGateway');
  }

  @SubscribeMessage('command')
  handleCommand(@ConnectedSocket() client: Socket, @MessageBody() rawPayload: unknown) {
    const payload = parseCommandEnvelope(rawPayload);
    const nowMs = Date.now();

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
