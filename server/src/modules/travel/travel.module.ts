import { Module } from '@nestjs/common';
import { TravelService } from './travel.service';
import { TravelController } from './travel.controller';
import { WorldModule } from '../world/world.module';
import { SimulationModule } from '../simulation/simulation.module';
import { DomainEventBus } from '../../common/domain-events';

@Module({
  imports: [WorldModule, SimulationModule],
  controllers: [TravelController],
  providers: [TravelService, DomainEventBus],
  exports: [TravelService],
})
export class TravelModule {}
