import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { SimulationModule } from '../simulation/simulation.module';

@Module({
  imports: [SimulationModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
