import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { SimulationModule } from './modules/simulation/simulation.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { AppLogger } from './common/logger.service';
import { ObservabilityModule } from './modules/observability/observability.module';

@Module({
  imports: [HealthModule, SimulationModule, RealtimeModule, ObservabilityModule],
  providers: [AppLogger],
  exports: [AppLogger],
})
export class AppModule {}
