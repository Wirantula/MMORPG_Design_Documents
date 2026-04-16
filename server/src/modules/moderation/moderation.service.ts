import { Injectable, Logger } from '@nestjs/common';
import { AdminService } from '../admin/admin.service';
import { AccountsService } from '../accounts/accounts.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  DomainEventBus,
  generateEventId,
  type ModerationActionApplied,
} from '../../common/domain-events';

// ── Types ────────────────────────────────────────────────────────────

export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type SanctionAction = 'warn' | 'mute' | 'ban' | 'note';

export interface PlayerReport {
  id: string;
  reporterId: string;
  targetId: string;
  reason: string;
  evidenceText: string;
  status: ReportStatus;
  resolvedBy: string | null;
  resolvedAction: SanctionAction | null;
  createdAt: string;
}

export interface SubmitReportDto {
  targetId: string;
  reason: string;
  evidenceText?: string;
}

export interface ResolveReportDto {
  action: SanctionAction;
  /** Duration in minutes for mute sanctions. Defaults to 60. */
  muteDurationMinutes?: number;
}

export interface PaginatedReports {
  reports: PlayerReport[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Service ──────────────────────────────────────────────────────────

let reportCounter = 0;
function nextReportId(): string {
  reportCounter += 1;
  return `rpt_${Date.now()}_${reportCounter}`;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly reports = new Map<string, PlayerReport>();

  constructor(
    private readonly adminService: AdminService,
    private readonly accountsService: AccountsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly eventBus: DomainEventBus,
  ) {}

  // ── Submit a player report ─────────────────────────────────────

  submitReport(reporterId: string, dto: SubmitReportDto): PlayerReport {
    if (!dto.targetId || !dto.reason) {
      throw new Error('targetId and reason are required');
    }

    if (dto.targetId === reporterId) {
      throw new Error('Cannot report yourself');
    }

    const report: PlayerReport = {
      id: nextReportId(),
      reporterId,
      targetId: dto.targetId,
      reason: dto.reason,
      evidenceText: dto.evidenceText ?? '',
      status: 'open',
      resolvedBy: null,
      resolvedAction: null,
      createdAt: new Date().toISOString(),
    };

    this.reports.set(report.id, report);

    this.logger.log(
      `ReportCreated: id=${report.id} reporter=${reporterId} target=${dto.targetId}`,
      'ModerationService',
    );

    return report;
  }

  // ── List reports (paginated) ───────────────────────────────────

  getReports(page = 1, pageSize = 20, statusFilter?: ReportStatus): PaginatedReports {
    let all = Array.from(this.reports.values());

    if (statusFilter) {
      all = all.filter((r) => r.status === statusFilter);
    }

    // Newest first
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = all.length;
    const start = (page - 1) * pageSize;
    const reports = all.slice(start, start + pageSize);

    return { reports, total, page, pageSize };
  }

  // ── Get single report ──────────────────────────────────────────

  getReportById(id: string): PlayerReport | undefined {
    return this.reports.get(id);
  }

  // ── Resolve a report with sanction ─────────────────────────────

  resolveReport(
    reportId: string,
    moderatorId: string,
    dto: ResolveReportDto,
  ): PlayerReport {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    if (report.status !== 'open') {
      throw new Error('Report is already resolved');
    }

    const validActions: SanctionAction[] = ['warn', 'mute', 'ban', 'note'];
    if (!validActions.includes(dto.action)) {
      throw new Error(`Invalid action: ${dto.action}`);
    }

    // Apply the sanction to the target account
    this.applySanction(report.targetId, dto);

    // Mark report resolved
    report.status = 'resolved';
    report.resolvedBy = moderatorId;
    report.resolvedAction = dto.action;

    // Emit domain event
    const event: ModerationActionApplied = {
      eventId: generateEventId(),
      type: 'ModerationActionApplied',
      timestamp: new Date().toISOString(),
      payload: {
        reportId,
        targetId: report.targetId,
        action: dto.action,
        moderatorId,
      },
    };
    this.eventBus.emit(event);

    // Write to admin audit log
    this.adminService.writeAuditLog(moderatorId, `moderation.${dto.action}`, {
      reportId,
      targetId: report.targetId,
      reason: report.reason,
    });

    this.logger.log(
      `ReportResolved: id=${reportId} action=${dto.action} moderator=${moderatorId} target=${report.targetId}`,
      'ModerationService',
    );

    return report;
  }

  // ── Internal: apply sanction to account ────────────────────────

  private applySanction(targetId: string, dto: ResolveReportDto): void {
    const account = this.accountsService.findById(targetId);
    if (!account) {
      throw new Error('Target account not found');
    }

    switch (dto.action) {
      case 'warn': {
        // Increment warning count on the account object
        const rec = account as unknown as Record<string, unknown>;
        const current = rec['warningCount'] as number | undefined;
        rec['warningCount'] = (current ?? 0) + 1;
        break;
      }

      case 'mute': {
        const minutes = dto.muteDurationMinutes ?? 60;
        const mutedUntil = new Date(Date.now() + minutes * 60_000).toISOString();
        (account as unknown as Record<string, unknown>)['mutedUntil'] = mutedUntil;

        // Notify target's WS session about the mute
        this.notifyTargetMuted(targetId, mutedUntil);
        break;
      }

      case 'ban': {
        (account as unknown as Record<string, unknown>)['banned'] = true;

        // Disconnect target's WS session
        this.disconnectTarget(targetId);
        break;
      }

      case 'note':
        // No account mutation — just a moderator note recorded via audit log.
        break;
    }
  }

  // ── WS helpers ─────────────────────────────────────────────────

  private notifyTargetMuted(targetId: string, mutedUntil: string): void {
    try {
      // Find socket for the target account and send notification
      const server = this.realtimeGateway.server;
      if (!server) return;

      const sockets = server.sockets?.sockets;
      if (!sockets) return;

      for (const [socketId, socket] of sockets) {
        if (this.realtimeGateway.getAccountId(socketId) === targetId) {
          socket.emit('event', {
            id: `sys:moderation.muted:${Date.now()}`,
            type: 'notification.new',
            timestamp: new Date().toISOString(),
            payload: {
              targetAccountId: targetId,
              title: 'Account Muted',
              body: `Your account has been muted until ${mutedUntil}.`,
              category: 'moderation',
            },
          });
        }
      }
    } catch {
      // Best-effort — don't let WS errors break the sanction flow
    }
  }

  private disconnectTarget(targetId: string): void {
    try {
      const server = this.realtimeGateway.server;
      if (!server) return;

      const sockets = server.sockets?.sockets;
      if (!sockets) return;

      for (const [socketId, socket] of sockets) {
        if (this.realtimeGateway.getAccountId(socketId) === targetId) {
          socket.emit('event', {
            id: `sys:moderation.banned:${Date.now()}`,
            type: 'error',
            timestamp: new Date().toISOString(),
            payload: { message: 'Your account has been banned.' },
          });
          socket.disconnect(true);
        }
      }
    } catch {
      // Best-effort
    }
  }
}
