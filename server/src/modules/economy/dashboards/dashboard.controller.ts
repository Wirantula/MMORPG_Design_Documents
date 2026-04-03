import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { SimulationService } from '../../simulation/simulation.service';

/**
 * All endpoints under /api/admin/economy.
 * RBAC gating will be enforced once the auth-accounts module ships (Story 12.1).
 * For now, these are exposed but documented as admin-only.
 */
@Controller('admin/economy')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly simulationService: SimulationService,
  ) {}

  @Get('summary')
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('sinks')
  getSinks() {
    const currentGameDay = this.simulationService.getGameDayNumber();
    return this.dashboardService.getSinks(currentGameDay);
  }

  @Get('faucets')
  getFaucets() {
    const currentGameDay = this.simulationService.getGameDayNumber();
    return this.dashboardService.getFaucets(currentGameDay);
  }

  @Get('shortages')
  getShortages() {
    const currentGameDay = this.simulationService.getGameDayNumber();
    return this.dashboardService.detectShortages(currentGameDay);
  }

  @Get('inflation')
  getInflation() {
    const currentGameDay = this.simulationService.getGameDayNumber();
    return this.dashboardService.detectInflation(currentGameDay);
  }

  @Get('export')
  exportReport() {
    const currentGameDay = this.simulationService.getGameDayNumber();
    const filePath = this.dashboardService.exportReport(currentGameDay);
    return { filePath };
  }
}
