import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminJwtGuard } from '../admin/admin.guard';
import { ModerationService, type ReportStatus, type SanctionAction } from './moderation.service';

// ── Player-facing endpoint ───────────────────────────────────────────

@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  /** POST /api/moderation/reports — authenticated player submits a report. */
  @Post('reports')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  submitReport(
    @Req() req: { accountId?: string },
    @Body() body: unknown,
  ) {
    const accountId = req.accountId;
    if (!accountId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const parsed = body as { targetId?: string; reason?: string; evidenceText?: string } | undefined;
    if (!parsed?.targetId || !parsed?.reason) {
      throw new HttpException('targetId and reason are required', HttpStatus.BAD_REQUEST);
    }

    try {
      return this.moderationService.submitReport(accountId, {
        targetId: parsed.targetId,
        reason: parsed.reason,
        evidenceText: parsed.evidenceText,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit report';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }
}

// ── Admin-facing endpoints ───────────────────────────────────────────

@Controller('admin/moderation')
@UseGuards(AdminJwtGuard)
export class AdminModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  /** GET /api/admin/moderation/reports — paginated moderation queue. */
  @Get('reports')
  getReports(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 20;
    const validStatuses: ReportStatus[] = ['open', 'resolved', 'dismissed'];
    const statusFilter = status && validStatuses.includes(status as ReportStatus)
      ? (status as ReportStatus)
      : undefined;

    return this.moderationService.getReports(p, ps, statusFilter);
  }

  /** PATCH /api/admin/moderation/reports/:id — resolve report with sanction. */
  @Patch('reports/:id')
  resolveReport(
    @Req() req: { accountId?: string },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const accountId = req.accountId;
    if (!accountId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const parsed = body as { action?: SanctionAction; muteDurationMinutes?: number } | undefined;
    if (!parsed?.action) {
      throw new HttpException('action is required (warn|mute|ban|note)', HttpStatus.BAD_REQUEST);
    }

    try {
      return this.moderationService.resolveReport(id, accountId, {
        action: parsed.action,
        muteDurationMinutes: parsed.muteDurationMinutes,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resolve report';
      const status = message === 'Report not found' ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
      throw new HttpException(message, status);
    }
  }
}
