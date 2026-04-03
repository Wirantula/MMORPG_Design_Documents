import {
  Controller,
  Get,
  Param,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { StatService } from './stat.service';

// ── Player-facing endpoint ──────────────────────────────────────

@Controller('characters')
export class StatController {
  constructor(private readonly statService: StatService) {}

  /**
   * GET /api/characters/:id/stats
   * Returns visible stats ONLY — hidden potential is never serialised here.
   */
  @Get(':id/stats')
  getVisibleStats(@Param('id') id: string) {
    const dto = this.statService.getVisibleStats(id);
    if (!dto) {
      throw new HttpException(
        'Character stats not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return dto;
  }
}

// ── Admin-only endpoint ─────────────────────────────────────────

@Controller('admin/characters')
export class AdminStatController {
  constructor(private readonly statService: StatService) {}

  /**
   * GET /api/admin/characters/:id/potential
   * RBAC-gated: requires x-admin-role header (placeholder until auth module).
   * Returns the full hidden potential layer.
   */
  @Get(':id/potential')
  getPotentialStats(
    @Param('id') id: string,
    @Headers('x-admin-role') adminRole?: string,
  ) {
    if (adminRole !== 'admin') {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    const dto = this.statService.getPotentialStats(id);
    if (!dto) {
      throw new HttpException(
        'Character potential not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return dto;
  }
}
