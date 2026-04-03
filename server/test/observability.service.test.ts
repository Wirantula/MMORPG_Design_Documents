import { describe, expect, it } from 'vitest';
import { ObservabilityService } from '../src/modules/observability/observability.service';

describe('ObservabilityService', () => {
  it('renders Prometheus-formatted metrics', () => {
    const service = new ObservabilityService();
    const output = service.renderPrometheusMetrics();

    // Should be a string
    expect(typeof output).toBe('string');

    // Must contain all four baseline metrics
    expect(output).toContain('cybaworld_process_uptime_seconds');
    expect(output).toContain('cybaworld_process_resident_memory_bytes');
    expect(output).toContain('cybaworld_process_heap_used_bytes');
    expect(output).toContain('cybaworld_process_start_time_seconds');
  });

  it('includes HELP and TYPE annotations per metric', () => {
    const service = new ObservabilityService();
    const output = service.renderPrometheusMetrics();

    const metrics = [
      'cybaworld_process_uptime_seconds',
      'cybaworld_process_resident_memory_bytes',
      'cybaworld_process_heap_used_bytes',
      'cybaworld_process_start_time_seconds',
    ];

    for (const metric of metrics) {
      expect(output).toContain(`# HELP ${metric}`);
      expect(output).toContain(`# TYPE ${metric} gauge`);
    }
  });

  it('emits numeric values for each metric', () => {
    const service = new ObservabilityService();
    const output = service.renderPrometheusMetrics();
    const lines = output.split('\n').filter((l) => !l.startsWith('#') && l.trim() !== '');

    // 4 process + 5 simulation + 1 offline = 10 metric lines
    expect(lines.length).toBe(10);

    for (const line of lines) {
      const parts = line.split(' ');
      expect(parts.length).toBe(2);
      const value = Number(parts[1]);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('reports a positive start time epoch', () => {
    const service = new ObservabilityService();
    const output = service.renderPrometheusMetrics();
    const match = output.match(/cybaworld_process_start_time_seconds (\d+)/);
    expect(match).not.toBeNull();
    const epoch = Number(match![1]);
    // Should be a reasonable epoch (after 2020-01-01)
    expect(epoch).toBeGreaterThan(1577836800);
  });
});
