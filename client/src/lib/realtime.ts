import { readRuntimeConfig } from './config';
import type { ClientCommandEnvelope } from './contracts';

export class RealtimeClient {
  private socket: WebSocket | null = null;

  connect(onMessage: (event: MessageEvent<string>) => void): void {
    const { wsBaseUrl } = readRuntimeConfig();
    this.socket = new WebSocket(wsBaseUrl);
    this.socket.addEventListener('message', onMessage);
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  sendCommand<TPayload>(envelope: ClientCommandEnvelope<TPayload>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Realtime socket is not connected.');
    }

    this.socket.send(
      JSON.stringify({
        event: 'command',
        data: envelope,
      }),
    );
  }
}
