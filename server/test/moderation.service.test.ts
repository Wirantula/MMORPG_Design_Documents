import { describe, expect, it, beforeEach, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { AdminService } from '../src/modules/admin/admin.service';
import { ObservabilityService } from '../src/modules/observability/observability.service';
import { ModerationService } from '../src/modules/moderation/moderation.service';
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
  const observabilityService = new ObservabilityService();

  const realtimeGateway = {
    connectedClientsCount: 0,
    server: {
      emit: vi.fn(),
      sockets: { sockets: new Map() },
    },
    getAccountId: vi.fn().mockReturnValue(undefined),
  } as unknown as ConstructorParameters<typeof AdminService>[1];

  const adminService = new AdminService(
    observabilityService,
    realtimeGateway,
    eventBus,
  );

  const moderationService = new ModerationService(
    adminService,
    accountsService,
    realtimeGateway as unknown as ConstructorParameters<typeof ModerationService>[2],
    eventBus,
  );

  return { eventBus, accountsService, authService, adminService, moderationService, realtimeGateway };
}

// ── Helper: register two accounts (reporter + target) ────────────────

async function setupAccounts(stack: ReturnType<typeof createStack>) {
  const reporter = await stack.authService.register({
    email: 'reporter@cybaworld.com',
    password: 'pass1234',
  });
  const target = await stack.authService.register({
    email: 'target@cybaworld.com',
    password: 'pass1234',
  });
  return {
    reporterId: reporter.accountId!,
    targetId: target.accountId!,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ModerationService', () => {
  let stack: ReturnType<typeof createStack>;

  beforeEach(() => {
    stack = createStack();
  });

  // ── Report creation ─────────────────────────────────────────────

  describe('submitReport', () => {
    it('creates a report with open status', async () => {
      const { reporterId, targetId } = await setupAccounts(stack);

      const report = stack.moderationService.submitReport(reporterId, {
        targetId,
        reason: 'harassment',
        evidenceText: 'Said bad things in chat',
      });

      expect(report.id).toBeTruthy();
      expect(report.reporterId).toBe(reporterId);
      expect(report.targetId).toBe(targetId);
      expect(report.reason).toBe('harassment');
      expect(report.evidenceText).toBe('Said bad things in chat');
      expect(report.status).toBe('open');
      expect(report.resolvedBy).toBeNull();
      expect(report.resolvedAction).toBeNull();
    });

    it('rejects report with missing targetId', async () => {
      const { reporterId } = await setupAccounts(stack);

      expect(() =>
        stack.moderationService.submitReport(reporterId, {
          targetId: '',
          reason: 'spam',
        }),
      ).toThrow('targetId and reason are required');
    });

    it('rejects self-report', async () => {
      const { reporterId } = await setupAccounts(stack);

      expect(() =>
        stack.moderationService.submitReport(reporterId, {
          targetId: reporterId,
          reason: 'testing',
        }),
      ).toThrow('Cannot report yourself');
    });
  });

  // ── Report listing ──────────────────────────────────────────────

  describe('getReports', () => {
    it('returns paginated reports newest-first', async () => {
      const { reporterId, targetId } = await setupAccounts(stack);

      stack.moderationService.submitReport(reporterId, { targetId, reason: 'r1' });
      stack.moderationService.submitReport(reporterId, { targetId, reason: 'r2' });
      stack.moderationService.submitReport(reporterId, { targetId, reason: 'r3' });

      const result = stack.moderationService.getReports(1, 2);
      expect(result.total).toBe(3);
      expect(result.reports).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
    });

    it('filters by status', async () => {
      const { reporterId, targetId } = await setupAccounts(stack);

      const r1 = stack.moderationService.submitReport(reporterId, { targetId, reason: 'r1' });
      stack.moderationService.submitReport(reporterId, { targetId, reason: 'r2' });

      stack.moderationService.resolveReport(r1.id, 'admin-1', { action: 'note' });

      const open = stack.moderationService.getReports(1, 20, 'open');
      expect(open.total).toBe(1);

      const resolved = stack.moderationService.getReports(1, 20, 'resolved');
      expect(resolved.total).toBe(1);
    });
  });

  // ── Warn sanction ──────────────────────────────────────────────

  describe('resolve — warn', () => {
    it('increments warning count on target account', async () => {
      const { reporterId, targetId } = await setupAccounts(stack);
      const report = stack.moderationService.submitReport(reporterId, { targetId, reason: 'spam' });

      const resolved = stack.moderationService.resolveReport(report.id, 'admin-1', { action: 'warn' });
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolvedAction).toBe('warn');

      const account = stack.accountsService.findById(targetId) as unknown as Record<string, unknown>;
      expect(account['warningCount']).toBe(1);
    });

    it('stacks warnings', async () => {
      const { reporterId, targetId } = await setupAccounts(stack);

      const r1 = stack.moderationService.submitReport(reporterId, { targetId, reason: 'spam' });
      stack.moderationService.resolveReport(r1.id, 'admin-1', { action: 'warn' });

      const r2 = stack.moderationService.submitReport(reporterId, { targetId, reason: 'spam again' });
      stack.moderationService.resolveReport(r2.id, 'admin-1', { action: 'warn' });

      const account = stack.accountsService.findById(targetId) as unknown as Record<string, unknown>;
      expect(account['warningCount']).toBe(2);
    });
  });

  // ── Mute sanction ──────────────────────────────────────────────

  describe('resolve — mute', () => {
    it('sets mutedUntil on target account', async () => {
      const { reporterId, targetId } = await setupAccounts(stack);
      const report = stack.moderationService.submitReport(reporterId, { targetId, reason: 'toxicity' });

      const before = Date.now();
      stack.moderationService.resolveReport(report.id, 'admin-1', {
        action: 'mute',
        muteDurationMinutes: 30,
      });

      const account = stack.accountsService.findById(targetId) as unknown as Record<string, unknown>;
      const mutedUntil = new Date(account['mutedUntil'] as string).getTime();

      // mutedUntil should be ~30 minutes in the future
      expect(mutedUntil).toBeGreaterThanOrEqual(before + 29 * 60_000);
      expect(mutedUntil).toBeLessThanOrEqual(before + 31 * 60_000);
    });
  });

  // ── Ban sanction ───────────────────────────────────────────────

  describe('resolve — ban', () => {
    it('sets banned flag on target account', async () => {
      const { reporterId, targetId } = await setupAccounts(stack);
      const report = stack.moderationService.submitReport(reporterId, { targetId, reason: 'cheating' });

      stack.moderationService.resolveReport(report.id, 'admin-1', { action: 'ban' });

      const account = stack.accountsService.findById(targetId) as unknown as Record<string, unknown>;
      expect(account['banned']).toBe(true);
    });
  });

  // ── Note sanction ──────────────────────────────────────────────

  describe('resolve — note', () => {
    it('resolves report without mutating account', async () => {
      const { reporterId, targetId } = await setupAccounts(stack);
      const report = stack.moderationService.submitReport(reporterId, { targetId, reason: 'false alarm' });

      const resolved = stack.moderationService.resolveReport(report.id, 'admin-1', { action: 'note' });
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolvedAction).toBe('note');

      const account = stack.accountsService.findById(targetId) as unknown as Record<string, unknown>;
      expect(account['banned']).toBeUndefined();
      expect(account['mutedUntil']).toBeUndefined();
      expect(account['warningCount']).toBeUndefined();
    });
  });

  // ── Audit log writes ──────────────────────────────────────────

  describe('audit log', () => {
    it('writes an audit entry for each resolved report', async () => {
      const { reporterId, targetId } = await setupAccounts(stack);
      const report = stack.moderationService.submitReport(reporterId, { targetId, reason: 'spam' });

      stack.moderationService.resolveReport(report.id, 'admin-1', { action: 'warn' });

      const log = stack.adminService.getAuditLog();
      expect(log.length).toBeGreaterThanOrEqual(1);
      expect(log[0].action).toBe('moderation.warn');
      expect(log[0].adminId).toBe('admin-1');
      expect(log[0].target).toEqual(
        expect.objectContaining({ reportId: report.id, targetId }),
      );
    });
  });

  // ── Domain event emission ──────────────────────────────────────

  describe('domain events', () => {
    it('emits ModerationActionApplied on resolve', async () => {
      const events: KnownDomainEvent[] = [];
      stack.eventBus.on('ModerationActionApplied', (e) => events.push(e));

      const { reporterId, targetId } = await setupAccounts(stack);
      const report = stack.moderationService.submitReport(reporterId, { targetId, reason: 'spam' });

      stack.moderationService.resolveReport(report.id, 'admin-1', { action: 'mute' });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('ModerationActionApplied');
      expect(events[0].payload).toEqual(
        expect.objectContaining({
          reportId: report.id,
          targetId,
          action: 'mute',
          moderatorId: 'admin-1',
        }),
      );
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────

  describe('edge cases', () => {
    it('rejects resolving a non-existent report', () => {
      expect(() =>
        stack.moderationService.resolveReport('rpt_nonexistent', 'admin-1', { action: 'warn' }),
      ).toThrow('Report not found');
    });

    it('rejects resolving an already-resolved report', async () => {
      const { reporterId, targetId } = await setupAccounts(stack);
      const report = stack.moderationService.submitReport(reporterId, { targetId, reason: 'spam' });

      stack.moderationService.resolveReport(report.id, 'admin-1', { action: 'note' });

      expect(() =>
        stack.moderationService.resolveReport(report.id, 'admin-1', { action: 'warn' }),
      ).toThrow('Report is already resolved');
    });
  });
});
