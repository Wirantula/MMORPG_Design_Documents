import { Module } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { TickService } from './tick.service';
import { ActionService } from './actions/action.service';
import { RoutineService } from './routines/routine.service';
import { ObservabilityModule } from '../observability/observability.module';
@Module({
  imports: [ObservabilityModule],
  providers: [SimulationService, TickService, ActionService, RoutineService],
  exports: [SimulationService, TickService, ActionService, RoutineService],
})
export class SimulationModule {}
