import { describe, expect, it } from 'vitest';
import { SimulationService } from '../src/modules/simulation/simulation.service';

describe('SimulationService', () => {
  it('uses default 1:30 realtime to world day ratio', () => {
    const service = new SimulationService();
    const startMs = Date.now();
    const nowMs = startMs + 86_400_000; // +1 realtime day

    const snapshot = service.getWorldSnapshot(nowMs);
    expect(snapshot.realtimeDayToWorldDayRatio).toBe('1:30');
    expect(snapshot.acceleration).toBe(30);
  });

  it('accepts configurable acceleration', () => {
    const service = new SimulationService({ acceleration: 60 });
    expect(service.getAcceleration()).toBe(60);

    const snapshot = service.getWorldSnapshot();
    expect(snapshot.realtimeDayToWorldDayRatio).toBe('1:60');
    expect(snapshot.acceleration).toBe(60);
  });

  it('accepts configurable world seed', () => {
    const seedMs = Date.UTC(2300, 0, 1);
    const service = new SimulationService({ worldSeedMs: seedMs });
    // At construction time, world time should be at or very near the seed
    const worldMs = service.getWorldTimeMs();
    expect(worldMs).toBeGreaterThanOrEqual(seedMs);
  });

  it('getWorldTimeMs advances faster than realtime', () => {
    const service = new SimulationService({ acceleration: 30 });
    const startMs = Date.now();
    const laterMs = startMs + 1000; // +1 real second

    const w0 = service.getWorldTimeMs(startMs);
    const w1 = service.getWorldTimeMs(laterMs);
    const worldElapsed = w1 - w0;

    // 1 real second * 30 acceleration = 30 000 world-ms
    expect(worldElapsed).toBe(30_000);
  });

  it('getGameDayNumber is 0 at startup', () => {
    const service = new SimulationService();
    const nowMs = Date.now();
    expect(service.getGameDayNumber(nowMs)).toBe(0);
  });

  it('getGameDayNumber increments after one game day of world time', () => {
    const service = new SimulationService({ acceleration: 30 });
    const startMs = Date.now();
    // One game day = 24h world-ms = 86_400_000 world-ms
    // At 30x acceleration: 86_400_000 / 30 = 2_880_000 real-ms
    const afterOneGameDay = startMs + 2_880_000;

    expect(service.getGameDayNumber(afterOneGameDay)).toBe(1);
  });

  it('snapshot includes gameDay', () => {
    const service = new SimulationService();
    const snapshot = service.getWorldSnapshot();
    expect(snapshot).toHaveProperty('gameDay');
    expect(typeof snapshot.gameDay).toBe('number');
  });
});
