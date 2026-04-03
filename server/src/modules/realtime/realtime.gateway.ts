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
import { AppLogger } from '../../common/logger.service';
import { SimulationService } from '../simulation/simulation.service';
import { parseCommandEnvelope } from './dto/command.dto';
import type { AckPayload, ServerEventEnvelope } from '../../contracts/message-envelope';

@WebSocketGateway({
  path: '/ws',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly logger: AppLogger,
    private readonly simulationService: SimulationService,
  ) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`, 'RealtimeGateway');
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`, 'RealtimeGateway');
  }

  @SubscribeMessage('command')
  handleCommand(@ConnectedSocket() client: Socket, @MessageBody() rawPayload: unknown) {
    const payload = parseCommandEnvelope(rawPayload);

    const ack: ServerEventEnvelope<AckPayload> = {
      id: payload.id,
      type: 'ack',
      timestamp: new Date().toISOString(),
      payload: {
        ok: true,
        receivedType: payload.type,
      },
    };

    client.emit('event', ack);
    client.emit('event', {
      id: `${payload.id}:snapshot`,
      type: 'world.snapshot',
      timestamp: new Date().toISOString(),
      payload: this.simulationService.getWorldSnapshot(),
    } satisfies ServerEventEnvelope);
  }
}
