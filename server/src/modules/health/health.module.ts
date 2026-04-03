import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ConditionsController } from './conditions.controller';
import { HealthService } from './health.service';
import { SimulationModule } from '../simulation/simulation.module';

@Module({
  imports: [SimulationModule],
  controllers: [HealthController, ConditionsController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
