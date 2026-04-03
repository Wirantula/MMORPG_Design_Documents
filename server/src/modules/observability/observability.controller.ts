import { Controller, Get, Header } from '@nestjs/common';
import { ObservabilityService } from './observability.service';

@Controller()
export class ObservabilityController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  getMetrics(): string {
    return this.observabilityService.renderPrometheusMetrics();
  }
}
