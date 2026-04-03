import { Injectable } from '@nestjs/common';

@Injectable()
export class ObservabilityService {
  private readonly startupEpochSeconds = Math.floor(Date.now() / 1000);

  renderPrometheusMetrics(): string {
    const uptime = Math.round(process.uptime());
    const mem = process.memoryUsage();

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
      '',
    ].join('\n');
  }
}
