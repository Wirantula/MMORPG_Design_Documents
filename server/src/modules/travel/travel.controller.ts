import { Controller, Get, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { TravelService, type CargoItem } from './travel.service';

interface StartTravelBody {
  characterId: string;
  fromNodeId: string;
  toNodeId: string;
  cargo: CargoItem[];
}

@Controller('travel')
export class TravelController {
  constructor(private readonly travelService: TravelService) {}

  @Post('start')
  startTravel(@Body() body: StartTravelBody) {
    if (!body.characterId || !body.fromNodeId || !body.toNodeId) {
      throw new HttpException(
        'characterId, fromNodeId, and toNodeId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = this.travelService.startJourney({
      characterId: body.characterId,
      fromNodeId: body.fromNodeId,
      toNodeId: body.toNodeId,
      cargo: body.cargo ?? [],
    });

    if (!result.ok) {
      throw new HttpException(result.error!, HttpStatus.BAD_REQUEST);
    }

    return result.journey;
  }

  @Get('journeys')
  getJourneys(@Query('character_id') characterId?: string) {
    if (characterId) {
      return this.travelService.getJourneysByCharacter(characterId);
    }
    return this.travelService.getActiveJourneys();
  }
}
