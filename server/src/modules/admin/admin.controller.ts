import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AdminJwtGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** GET /api/admin/dashboard — server uptime, connected clients, etc. */
  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardStatus();
  }

  /** GET /api/admin/status — DB, Redis, tick health. */
  @Get('status')
  getStatus() {
    return this.adminService.getServiceStatus();
  }

  /** POST /api/admin/maintenance — toggle maintenance mode. */
  @Post('maintenance')
  @HttpCode(HttpStatus.OK)
  toggleMaintenance(
    @Req() req: { accountId?: string },
    @Body() body: unknown,
  ) {
    const accountId = req.accountId;
    if (!accountId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const parsed = body as { enabled?: boolean } | undefined;
    const enabled = parsed?.enabled ?? true;

    return this.adminService.toggleMaintenance(accountId, enabled);
  }

  /** GET /api/admin/audit-log — last 100 admin actions. */
  @Get('audit-log')
  getAuditLog() {
    return this.adminService.getAuditLog();
  }
}
