import { Injectable } from '@nestjs/common';

export interface SimulationMetricsSnapshot {
  tickCount: number;
  lastTickDurationMs: number;
  maxTickDurationMs: number;
  currentGameDay: number;
  driftMs: number;
}

@Injectable()
export class ObservabilityService {
  private readonly startupEpochSeconds = Math.floor(Date.now() / 1000);
  private simMetrics: SimulationMetricsSnapshot = {
    tickCount: 0,
    lastTickDurationMs: 0,
    maxTickDurationMs: 0,
    currentGameDay: 0,
    driftMs: 0,
  };

  recordSimulationMetrics(metrics: SimulationMetricsSnapshot): void {
    this.simMetrics = metrics;
  }

  getSimulationMetrics(): SimulationMetricsSnapshot {
    return { ...this.simMetrics };
  }

  renderPrometheusMetrics(): string {
    const uptime = Math.round(process.uptime());
    const mem = process.memoryUsage();
    const sim = this.simMetrics;

    return [
      '# HELP cybaworld_process_uptime_seconds Process uptime in seconds.',
      '# TYPE cybaworld_process_uptime_seconds gauge',
      `cybaworld_process_uptime_seconds ${uptime}`,
      '# HELP cybaworld_process_resident_memory_bytes Resident memory usage in bytes.',
      '# TYPE cybaworld_process_resident_memory_bytes gauge',
      `cybaworld_process_resident_memory_bytes ${mem.rss}`,
      '# HELP cybaworld_process_heap_used_bytes Heap used in bytes.',
      '# TYPE cybaworld_process_heap_used_bytes gauge',
      `cybaworld_process_heap_used_bytes ${mem.heapUsed}`,
      '# HELP cybaworld_process_start_time_seconds Server start epoch timestamp.',
      '# TYPE cybaworld_process_start_time_seconds gauge',
      `cybaworld_process_start_time_seconds ${this.startupEpochSeconds}`,
      '# HELP cybaworld_simulation_tick_count Total simulation ticks executed.',
      '# TYPE cybaworld_simulation_tick_count counter',
      `cybaworld_simulation_tick_count ${sim.tickCount}`,
      '# HELP cybaworld_simulation_tick_duration_ms Duration of last tick in milliseconds.',
      '# TYPE cybaworld_simulation_tick_duration_ms gauge',
      `cybaworld_simulation_tick_duration_ms ${sim.lastTickDurationMs.toFixed(2)}`,
      '# HELP cybaworld_simulation_tick_max_duration_ms Maximum tick duration observed.',
      '# TYPE cybaworld_simulation_tick_max_duration_ms gauge',
      `cybaworld_simulation_tick_max_duration_ms ${sim.maxTickDurationMs.toFixed(2)}`,
      '# HELP cybaworld_simulation_current_game_day Current in-game day number.',
      '# TYPE cybaworld_simulation_current_game_day gauge',
      `cybaworld_simulation_current_game_day ${sim.currentGameDay}`,
      '# HELP cybaworld_simulation_drift_ms Tick loop drift from expected schedule.',
      '# TYPE cybaworld_simulation_drift_ms gauge',
      `cybaworld_simulation_drift_ms ${sim.driftMs}`,
      '',
    ].join('\n');
  }
}
