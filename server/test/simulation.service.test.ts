import { describe, expect, it } from 'vitest';
import { SimulationService } from '../src/modules/simulation/simulation.service';

describe('SimulationService', () => {
  it('uses 1:30 realtime to world day ratio', () => {
    const service = new SimulationService();
    const startMs = Date.now();
    const nowMs = startMs + 86_400_000; // +1 realtime day

    const snapshot = service.getWorldSnapshot(nowMs);
    expect(snapshot.realtimeDayToWorldDayRatio).toBe('1:30');
    expect(snapshot.acceleration).toBe(30);
  });
});
