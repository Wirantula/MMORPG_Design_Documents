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
  private offlineRoutinesProcessed = 0;
  private economyMetrics = {
    totalTradeCount: 0,
    activeListings: 0,
    activeOrders: 0,
    activeContracts: 0,
    totalFeesCollected: 0,
  };

  recordSimulationMetrics(metrics: SimulationMetricsSnapshot): void {
    this.simMetrics = metrics;
  }

  getSimulationMetrics(): SimulationMetricsSnapshot {
    return { ...this.simMetrics };
  }

  recordOfflineRoutinesProcessed(count: number): void {
    this.offlineRoutinesProcessed += count;
  }

  getOfflineRoutinesProcessed(): number {
    return this.offlineRoutinesProcessed;
  }

  recordEconomyMetrics(metrics: {
    totalTradeCount: number;
    activeListings: number;
    activeOrders: number;
    activeContracts: number;
    totalFeesCollected: number;
  }): void {
    this.economyMetrics = metrics;
  }

  getEconomyMetrics() {
    return { ...this.economyMetrics };
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
      '# HELP cybaworld_offline_routines_processed_total Total offline routine batches processed.',
      '# TYPE cybaworld_offline_routines_processed_total counter',
      `cybaworld_offline_routines_processed_total ${this.offlineRoutinesProcessed}`,
      '# HELP cybaworld_economy_trade_count Total market trades executed.',
      '# TYPE cybaworld_economy_trade_count counter',
      `cybaworld_economy_trade_count ${this.economyMetrics.totalTradeCount}`,
      '# HELP cybaworld_economy_active_listings Current active market listings.',
      '# TYPE cybaworld_economy_active_listings gauge',
      `cybaworld_economy_active_listings ${this.economyMetrics.activeListings}`,
      '# HELP cybaworld_economy_active_orders Current active buy orders.',
      '# TYPE cybaworld_economy_active_orders gauge',
      `cybaworld_economy_active_orders ${this.economyMetrics.activeOrders}`,
      '# HELP cybaworld_economy_active_contracts Current active contracts.',
      '# TYPE cybaworld_economy_active_contracts gauge',
      `cybaworld_economy_active_contracts ${this.economyMetrics.activeContracts}`,
      '# HELP cybaworld_economy_fees_collected_total Total listing fees collected (sink).',
      '# TYPE cybaworld_economy_fees_collected_total counter',
      `cybaworld_economy_fees_collected_total ${this.economyMetrics.totalFeesCollected}`,
      '',
    ].join('\n');
  }
}
