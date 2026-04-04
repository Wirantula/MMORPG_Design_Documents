import { Injectable, Logger } from '@nestjs/common';
import { ObservabilityService } from '../observability/observability.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  DomainEventBus,
  generateEventId,
  type MaintenanceModeToggled,
} from '../../common/domain-events';
import type { ServerEventEnvelope } from '../../contracts/message-envelope';

// ── Audit log entry (in-memory until Postgres migration runs) ────────
export interface AuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  target: Record<string, unknown> | null;
  createdAt: string;
}

// ── Dashboard status shape ───────────────────────────────────────────
export interface AdminDashboardStatus {
  serverUptimeSeconds: number;
  connectedClients: number;
  activeCharacters: number;
  lastTickAt: string;
  maintenanceMode: boolean;
}

// ── Service status shape ─────────────────────────────────────────────
export interface ServiceStatus {
  database: 'connected' | 'unavailable';
  redis: 'connected' | 'unavailable';
  tickHealth: 'healthy' | 'degraded' | 'stalled';
  lastTickDurationMs: number;
  tickDriftMs: number;
}

const MAX_AUDIT_LOG = 100;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  private maintenanceMode = false;
  private readonly auditLog: AuditLogEntry[] = [];

  constructor(
    private readonly observabilityService: ObservabilityService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly eventBus: DomainEventBus,
  ) {}

  // ── Dashboard ──────────────────────────────────────────────────

  getDashboardStatus(): AdminDashboardStatus {
    const sim = this.observabilityService.getSimulationMetrics();
    return {
      serverUptimeSeconds: Math.round(process.uptime()),
      connectedClients: this.realtimeGateway.connectedClientsCount,
      activeCharacters: 0, // TODO: wire when CharactersService exposes active count
      lastTickAt: sim.tickCount > 0 ? new Date().toISOString() : '',
      maintenanceMode: this.maintenanceMode,
    };
  }

  // ── Service status ─────────────────────────────────────────────

  getServiceStatus(): ServiceStatus {
    const sim = this.observabilityService.getSimulationMetrics();

    // In-memory mode: DB and Redis are reported as 'unavailable' until
    // persistence layer lands. Tick health is derived from drift.
    const tickHealth =
      sim.driftMs > 5000 ? 'stalled' : sim.driftMs > 2000 ? 'degraded' : 'healthy';

    return {
      database: 'unavailable',
      redis: 'unavailable',
      tickHealth,
      lastTickDurationMs: sim.lastTickDurationMs,
      tickDriftMs: sim.driftMs,
    };
  }

  // ── Maintenance mode ───────────────────────────────────────────

  get isMaintenanceMode(): boolean {
    return this.maintenanceMode;
  }

  toggleMaintenance(adminId: string, enabled: boolean): { maintenanceMode: boolean } {
    this.maintenanceMode = enabled;

    // Broadcast to all connected WS clients
    this.realtimeGateway.server?.emit('event', {
      id: `sys:maintenance:${Date.now()}`,
      type: 'maintenance',
      timestamp: new Date().toISOString(),
      payload: { enabled },
    } satisfies ServerEventEnvelope);

    // Emit domain event
    const event: MaintenanceModeToggled = {
      eventId: generateEventId(),
      type: 'MaintenanceModeToggled',
      timestamp: new Date().toISOString(),
      payload: { enabled, adminId },
    };
    this.eventBus.emit(event);

    // Write audit log
    this.writeAuditLog(adminId, 'maintenance.toggle', { enabled });

    this.logger.log(
      `MaintenanceModeToggled: enabled=${enabled} admin=${adminId}`,
      'AdminService',
    );

    return { maintenanceMode: this.maintenanceMode };
  }

  // ── Audit log ──────────────────────────────────────────────────

  writeAuditLog(adminId: string, action: string, target: Record<string, unknown> | null = null): void {
    const entry: AuditLogEntry = {
      id: generateEventId(),
      adminId,
      action,
      target,
      createdAt: new Date().toISOString(),
    };

    this.auditLog.unshift(entry);

    // Cap at MAX_AUDIT_LOG
    if (this.auditLog.length > MAX_AUDIT_LOG) {
      this.auditLog.length = MAX_AUDIT_LOG;
    }

    this.logger.log(
      `AuditLog: action=${action} admin=${adminId}`,
      'AdminService',
    );
  }

  getAuditLog(limit = MAX_AUDIT_LOG): AuditLogEntry[] {
    return this.auditLog.slice(0, limit);
  }
}
