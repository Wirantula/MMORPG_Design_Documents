import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { SimulationModule } from '../simulation/simulation.module';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [SimulationModule, AuthModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
