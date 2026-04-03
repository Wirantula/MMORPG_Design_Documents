import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { SimulationModule } from './modules/simulation/simulation.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { AppLogger } from './common/logger.service';
import { DomainEventBus } from './common/domain-events';
import { ObservabilityModule } from './modules/observability/observability.module';
import { EconomyModule } from './modules/economy/economy.module';

@Module({
  imports: [HealthModule, SimulationModule, RealtimeModule, ObservabilityModule, EconomyModule],
  providers: [AppLogger, DomainEventBus],
  exports: [AppLogger, DomainEventBus],
})
export class AppModule {}
