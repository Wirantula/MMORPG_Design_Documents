import { Controller, Get } from '@nestjs/common';
import { SimulationService } from '../simulation/simulation.service';

@Controller('health')
export class HealthController {
  constructor(private readonly simulationService: SimulationService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      simulation: this.simulationService.getWorldSnapshot(),
    };
  }
}
