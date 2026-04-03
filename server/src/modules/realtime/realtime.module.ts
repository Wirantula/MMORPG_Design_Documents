import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { SimulationModule } from '../simulation/simulation.module';
import { AuthModule } from '../auth/auth.module';
import { DomainEventBus } from '../../common/domain-events';

@Module({
  imports: [SimulationModule, AuthModule],
  providers: [RealtimeGateway, DomainEventBus],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
