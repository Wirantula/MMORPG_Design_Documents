import { Controller, Get, Param } from '@nestjs/common';
import { NeedsService } from './needs.service';

@Controller('characters')
export class NeedsController {
  constructor(private readonly needsService: NeedsService) {}

  @Get(':id/needs')
  getCharacterNeeds(@Param('id') characterId: string) {
    return {
      characterId,
      needs: this.needsService.getNeedsStatus(characterId),
    };
  }
}
