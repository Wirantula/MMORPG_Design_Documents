import { Controller, Get, Param } from '@nestjs/common';
import { HealthService } from './health.service';
import { SimulationService } from '../simulation/simulation.service';

@Controller('characters')
export class ConditionsController {
  constructor(
    private readonly healthService: HealthService,
    private readonly simulationService: SimulationService,
  ) {}

  @Get(':id/health')
  getCharacterHealth(@Param('id') characterId: string) {
    const currentGameDay = this.simulationService.getGameDayNumber();
    const prognosis = this.healthService.getConditionsWithPrognosis(characterId, currentGameDay);
    const totalPenalty = this.healthService.getTotalStatPenalty(characterId);

    return {
      characterId,
      currentGameDay,
      totalStatPenalty: totalPenalty,
      conditions: prognosis,
    };
  }
}
