import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { ContractsService } from './contracts/contracts.service';
import { ContractsController } from './contracts/contracts.controller';
import { DashboardService } from './dashboards/dashboard.service';
import { DashboardController } from './dashboards/dashboard.controller';
import { SimulationModule } from '../simulation/simulation.module';
import { DomainEventBus } from '../../common/domain-events';

@Module({
  imports: [SimulationModule],
  controllers: [MarketController, ContractsController, DashboardController],
  providers: [
    MarketService,
    ContractsService,
    DashboardService,
    DomainEventBus,
  ],
  exports: [MarketService, ContractsService, DashboardService],
})
export class EconomyModule {}
