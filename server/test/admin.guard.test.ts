import { describe, expect, it, beforeEach, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { AdminJwtGuard } from '../src/modules/admin/admin.guard';
import { AdminService } from '../src/modules/admin/admin.service';
import { ObservabilityService } from '../src/modules/observability/observability.service';
import { DomainEventBus, type KnownDomainEvent } from '../src/common/domain-events';

const JWT_SECRET = 'test-secret';

function createStack() {
  const eventBus = new DomainEventBus();
  const accountsService = new AccountsService();
  const jwtService = new JwtService({
    secret: JWT_SECRET,
    signOptions: { expiresIn: '15m' },
  });
  const authService = new AuthService(accountsService, jwtService, eventBus);
  const guard = new AdminJwtGuard(authService, accountsService);

  const observabilityService = new ObservabilityService();

  // Minimal mock for RealtimeGateway — only properties AdminService actually reads.
  const realtimeGateway = {
    connectedClientsCount: 2,
    server: {
      emit: vi.fn(),
    },
  } as unknown as ConstructorParameters<typeof AdminService>[1];

  const adminService = new AdminService(
    observabilityService,
    realtimeGateway,
    eventBus,
  );

  return { eventBus, accountsService, authService, jwtService, guard, adminService, realtimeGateway };
}

function fakeContext(token?: string) {
  const req: Record<string, unknown> = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as import('@nestjs/common').ExecutionContext;
}

// ── AdminJwtGuard tests ──────────────────────────────────────────────

describe('AdminJwtGuard', () => {
  let stack: ReturnType<typeof createStack>;

  beforeEach(() => {
    stack = createStack();
  });

  it('rejects requests with no token', () => {
    expect(() => stack.guard.canActivate(fakeContext())).toThrow(UnauthorizedException);
  });

  it('rejects requests with an invalid JWT', () => {
    expect(() => stack.guard.canActivate(fakeContext('invalid.jwt.here'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a valid JWT from a player (non-admin) account', async () => {
    const reg = await stack.authService.register({
      email: 'player@cybaworld.com',
      password: 'securePass123',
    });
    const token = reg.tokens!.accessToken;

    // Account role defaults to 'player'
    expect(() => stack.guard.canActivate(fakeContext(token))).toThrow(ForbiddenException);
  });

  it('accepts a valid JWT from an admin account', async () => {
    const reg = await stack.authService.register({
      email: 'admin@cybaworld.com',
      password: 'adminPass123',
    });
    const token = reg.tokens!.accessToken;

    // Promote to admin
    const account = stack.accountsService.findById(reg.accountId!)!;
    account.role = 'admin';

    const result = stack.guard.canActivate(fakeContext(token));
    expect(result).toBe(true);
  });

  it('attaches accountId to the request', async () => {
    const reg = await stack.authService.register({
      email: 'admin2@cybaworld.com',
      password: 'adminPass123',
    });
    const token = reg.tokens!.accessToken;
    const account = stack.accountsService.findById(reg.accountId!)!;
    account.role = 'admin';

    const ctx = fakeContext(token);
    stack.guard.canActivate(ctx);

    const req = ctx.switchToHttp().getRequest() as { accountId?: string };
    expect(req.accountId).toBe(reg.accountId);
  });
});

// ── AdminService tests ───────────────────────────────────────────────

describe('AdminService', () => {
  let stack: ReturnType<typeof createStack>;

  beforeEach(() => {
    stack = createStack();
  });

  describe('getDashboardStatus', () => {
    it('returns expected shape', () => {
      const status = stack.adminService.getDashboardStatus();
      expect(status).toHaveProperty('serverUptimeSeconds');
      expect(status).toHaveProperty('connectedClients');
      expect(status).toHaveProperty('activeCharacters');
      expect(status).toHaveProperty('lastTickAt');
      expect(status).toHaveProperty('maintenanceMode');
      expect(status.maintenanceMode).toBe(false);
    });
  });

  describe('getServiceStatus', () => {
    it('returns expected shape with tick health', () => {
      const status = stack.adminService.getServiceStatus();
      expect(status).toHaveProperty('database');
      expect(status).toHaveProperty('redis');
      expect(status).toHaveProperty('tickHealth');
      expect(status).toHaveProperty('lastTickDurationMs');
      expect(status).toHaveProperty('tickDriftMs');
    });
  });

  describe('toggleMaintenance', () => {
    it('enables and disables maintenance mode', () => {
      expect(stack.adminService.isMaintenanceMode).toBe(false);

      const on = stack.adminService.toggleMaintenance('admin-1', true);
      expect(on.maintenanceMode).toBe(true);
      expect(stack.adminService.isMaintenanceMode).toBe(true);

      const off = stack.adminService.toggleMaintenance('admin-1', false);
      expect(off.maintenanceMode).toBe(false);
      expect(stack.adminService.isMaintenanceMode).toBe(false);
    });

    it('broadcasts maintenance event to WS clients', () => {
      stack.adminService.toggleMaintenance('admin-1', true);

      const server = stack.realtimeGateway.server as unknown as { emit: ReturnType<typeof vi.fn> };
      expect(server.emit).toHaveBeenCalledWith(
        'event',
        expect.objectContaining({
          type: 'maintenance',
          payload: { enabled: true },
        }),
      );
    });

    it('emits MaintenanceModeToggled domain event', () => {
      const events: KnownDomainEvent[] = [];
      stack.eventBus.on('MaintenanceModeToggled', (e) => events.push(e));

      stack.adminService.toggleMaintenance('admin-1', true);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('MaintenanceModeToggled');
      expect(events[0].payload).toEqual({ enabled: true, adminId: 'admin-1' });
    });

    it('writes audit log entry on toggle', () => {
      stack.adminService.toggleMaintenance('admin-1', true);

      const log = stack.adminService.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].action).toBe('maintenance.toggle');
      expect(log[0].adminId).toBe('admin-1');
    });
  });

  describe('audit log', () => {
    it('records and retrieves audit entries in reverse chronological order', () => {
      stack.adminService.writeAuditLog('admin-1', 'test.action1', { foo: 1 });
      stack.adminService.writeAuditLog('admin-1', 'test.action2', { foo: 2 });

      const log = stack.adminService.getAuditLog();
      expect(log).toHaveLength(2);
      expect(log[0].action).toBe('test.action2');
      expect(log[1].action).toBe('test.action1');
    });

    it('caps at 100 entries', () => {
      for (let i = 0; i < 120; i++) {
        stack.adminService.writeAuditLog('admin-1', `action-${i}`);
      }
      expect(stack.adminService.getAuditLog()).toHaveLength(100);
    });
  });
});
