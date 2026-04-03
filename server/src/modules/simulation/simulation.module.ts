import { Module } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { TickService } from './tick.service';
import { ActionService } from './actions/action.service';
import { ObservabilityModule } from '../observability/observability.module';
import { AppLogger } from '../../common/logger.service';
import { DomainEventBus } from '../../common/domain-events';

@Module({
  imports: [ObservabilityModule],
  providers: [SimulationService, TickService, ActionService, AppLogger, DomainEventBus],
  exports: [SimulationService, TickService, ActionService],
})
export class SimulationModule {}
