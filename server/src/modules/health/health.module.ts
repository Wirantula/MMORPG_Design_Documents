import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SimulationModule } from '../simulation/simulation.module';

@Module({
  imports: [SimulationModule],
  controllers: [HealthController],
})
export class HealthModule {}
