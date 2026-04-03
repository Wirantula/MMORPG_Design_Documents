import { Injectable } from '@nestjs/common';

export interface WorldSnapshot {
  realtimeUtc: string;
  worldUtc: string;
  acceleration: number;
  realtimeDayToWorldDayRatio: string;
}

@Injectable()
export class SimulationService {
  private readonly startupRealtimeMs = Date.now();
  private readonly worldSeedTimeMs = Date.UTC(2200, 0, 1, 0, 0, 0);
  private readonly acceleration = 30; // 1 realtime day = 30 world days

  getWorldSnapshot(nowMs = Date.now()): WorldSnapshot {
    const elapsedRealtimeMs = nowMs - this.startupRealtimeMs;
    const elapsedWorldMs = elapsedRealtimeMs * this.acceleration;
    const worldTime = new Date(this.worldSeedTimeMs + elapsedWorldMs);
    const realtime = new Date(nowMs);

    return {
      realtimeUtc: realtime.toISOString(),
      worldUtc: worldTime.toISOString(),
      acceleration: this.acceleration,
      realtimeDayToWorldDayRatio: '1:30',
    };
  }
}
