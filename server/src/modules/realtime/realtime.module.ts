import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { SimulationModule } from '../simulation/simulation.module';
import { AppLogger } from '../../common/logger.service';

@Module({
  imports: [SimulationModule],
  providers: [RealtimeGateway, AppLogger],
})
export class RealtimeModule {}
