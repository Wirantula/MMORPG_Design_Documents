import { Injectable } from '@nestjs/common';

export interface SimulationConfig {
  worldSeedMs: number;
  acceleration: number;
}

export interface WorldSnapshot {
  realtimeUtc: string;
  worldUtc: string;
  acceleration: number;
  realtimeDayToWorldDayRatio: string;
  gameDay: number;
}

const GAME_DAY_MS = 24 * 60 * 60 * 1000; // one in-game day in world-ms

@Injectable()
export class SimulationService {
  private readonly startupRealtimeMs: number;
  private readonly worldSeedTimeMs: number;
  private readonly acceleration: number;

  constructor(config?: Partial<SimulationConfig>) {
    this.startupRealtimeMs = Date.now();
    this.worldSeedTimeMs = config?.worldSeedMs ?? Date.UTC(2200, 0, 1, 0, 0, 0);
    this.acceleration = config?.acceleration ?? 30;
  }

  /** Absolute world-time in ms for a given realtime ms. */
  getWorldTimeMs(nowMs = Date.now()): number {
    const elapsedRealtimeMs = nowMs - this.startupRealtimeMs;
    return this.worldSeedTimeMs + elapsedRealtimeMs * this.acceleration;
  }

  /** Integer game-day index (0-based) since world seed. */
  getGameDayNumber(nowMs = Date.now()): number {
    const worldMs = this.getWorldTimeMs(nowMs);
    return Math.floor((worldMs - this.worldSeedTimeMs) / GAME_DAY_MS);
  }

  /** Current acceleration factor. */
  getAcceleration(): number {
    return this.acceleration;
  }

  getWorldSnapshot(nowMs = Date.now()): WorldSnapshot {
    const worldMs = this.getWorldTimeMs(nowMs);
    const worldTime = new Date(worldMs);
    const realtime = new Date(nowMs);

    return {
      realtimeUtc: realtime.toISOString(),
      worldUtc: worldTime.toISOString(),
      acceleration: this.acceleration,
      realtimeDayToWorldDayRatio: `1:${this.acceleration}`,
      gameDay: this.getGameDayNumber(nowMs),
    };
  }
}
