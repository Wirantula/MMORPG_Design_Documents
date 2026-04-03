import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TraitService } from './trait.service';

// ── Player-facing endpoint ──────────────────────────────────────

@Controller('characters')
export class TraitController {
  constructor(private readonly traitService: TraitService) {}

  /**
   * GET /api/characters/:id/hints
   * Returns narrative hint strings only — raw trait weights are NEVER exposed.
   */
  @Get(':id/hints')
  getHints(@Param('id') id: string) {
    const dto = this.traitService.generateHints(id);
    if (!dto) {
      throw new HttpException(
        'Character traits not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return dto;
  }
}
