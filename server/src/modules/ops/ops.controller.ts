import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../admin/admin.guard';
import { OpsService } from './ops.service';

@Controller('admin/ops')
@UseGuards(AdminJwtGuard)
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  /** GET /api/admin/ops/backups — list available backups with size and timestamp. */
  @Get('backups')
  listBackups() {
    return this.opsService.listBackups();
  }

  /** POST /api/admin/ops/restore/dry-run — validate backup file integrity. */
  @Post('restore/dry-run')
  @HttpCode(HttpStatus.OK)
  dryRunRestore(@Body() body: unknown) {
    const parsed = body as { filename?: string } | undefined;
    const filename = parsed?.filename;

    if (!filename || typeof filename !== 'string') {
      throw new HttpException('Missing required field: filename', HttpStatus.BAD_REQUEST);
    }

    return this.opsService.dryRunRestore(filename);
  }

  /** GET /api/admin/ops/version — current git commit hash and deploy timestamp. */
  @Get('version')
  getVersion() {
    return this.opsService.getVersion();
  }
}
