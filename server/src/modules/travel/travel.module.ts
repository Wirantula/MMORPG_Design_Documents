import { Module } from '@nestjs/common';
import { TravelService } from './travel.service';
import { TravelController } from './travel.controller';
import { WorldModule } from '../world/world.module';
import { SimulationModule } from '../simulation/simulation.module';

@Module({
  imports: [WorldModule, SimulationModule],
  controllers: [TravelController],
  providers: [TravelService],
  exports: [TravelService],
})
export class TravelModule {}
