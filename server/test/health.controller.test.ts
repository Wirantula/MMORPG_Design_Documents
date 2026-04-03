import { describe, expect, it } from 'vitest';
import { HealthController } from '../src/modules/health/health.controller';
import { SimulationService } from '../src/modules/simulation/simulation.service';

describe('HealthController', () => {
  it('returns status ok with simulation snapshot', () => {
    const simulationService = new SimulationService();
    const controller = new HealthController(simulationService);

    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(typeof result.uptimeSeconds).toBe('number');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(result.simulation).toBeDefined();
    expect(result.simulation.acceleration).toBe(30);
    expect(result.simulation.realtimeDayToWorldDayRatio).toBe('1:30');
    expect(typeof result.simulation.realtimeUtc).toBe('string');
    expect(typeof result.simulation.worldUtc).toBe('string');
  });

  it('returns a valid ISO 8601 realtimeUtc string', () => {
    const simulationService = new SimulationService();
    const controller = new HealthController(simulationService);

    const result = controller.getHealth();
    const parsed = new Date(result.simulation.realtimeUtc);
    expect(parsed.toISOString()).toBe(result.simulation.realtimeUtc);
  });

  it('returns a valid ISO 8601 worldUtc string', () => {
    const simulationService = new SimulationService();
    const controller = new HealthController(simulationService);

    const result = controller.getHealth();
    const parsed = new Date(result.simulation.worldUtc);
    expect(parsed.toISOString()).toBe(result.simulation.worldUtc);
  });

  it('returns integer uptimeSeconds', () => {
    const simulationService = new SimulationService();
    const controller = new HealthController(simulationService);

    const result = controller.getHealth();
    expect(Number.isInteger(result.uptimeSeconds)).toBe(true);
  });
});
