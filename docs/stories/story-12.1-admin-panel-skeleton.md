# Story 12.1 — Admin Panel Skeleton
**Epic:** 12 | **Role:** Backend Agent + Frontend Agent | **Status:** Blocked on 2.1 + 1.3

## Problem / intent
The host needs a browser management panel to run the game from a single application.

## Acceptance criteria
- [ ] /admin route in Next.js client is protected (redirects to /login if no admin JWT)
- [ ] Admin dashboard shows: server uptime, connected_clients, active_characters, last_tick_at
- [ ] Admin role gated by account.role = 'admin' (new column on accounts table)
- [ ] Service status page: DB connection, Redis connection, tick health
- [ ] Maintenance mode toggle: POST /api/admin/maintenance (broadcasts to all WS clients)
- [ ] Audit log page: last 100 admin actions
- [ ] Unit tests: admin JWT guard, maintenance broadcast, audit log write

## Dependencies
- 2.1 ✅  |  1.3 ✅

## Scope
Only touch: server/src/modules/admin/, client/src/app/admin/, infra/migrations/, server/test/
Do NOT touch: simulation core/, economy/, characters/

## Implementation notes
- Add role column to accounts: ALTER TABLE accounts ADD COLUMN role VARCHAR DEFAULT 'player'
- AdminJwtGuard: extends JwtAuthGuard, checks account.role = 'admin'
- Audit log table: admin_audit_log (id, admin_id, action, target, created_at)
- Maintenance mode: Redis key 'maintenance_mode' + WS broadcast

## Test notes
server/test/admin.guard.test.ts — player role rejected, admin role accepted

## Observability notes
All admin actions write to admin_audit_log

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend and Frontend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 12.1 - Admin Panel Skeleton.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-12.1-admin-panel-skeleton.md && cat server/src/modules/auth/jwt-auth.guard.ts && cat server/src/modules/observability/observability.service.ts

STEP 2 - Implement:
  Create infra/migrations/022_add_admin_role.sql: add role column to accounts; create admin_audit_log
  Create server/src/modules/admin/: admin.module.ts, admin.guard.ts (role check), admin.service.ts (getStatus, toggleMaintenance, getAuditLog), admin.controller.ts
  Create client/src/app/admin/: layout.tsx (admin auth check), page.tsx (dashboard), status/page.tsx, audit/page.tsx
  POST /api/admin/maintenance, GET /api/admin/status, GET /api/admin/audit-log

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/12.1-admin-panel
  git add server/src/modules/admin/ client/src/app/admin/ infra/migrations/022_add_admin_role.sql server/test/
  git commit -m "feat(12.1): admin panel skeleton with RBAC, status, maintenance mode, audit log"
  gh pr create --draft --title "feat(12.1): admin panel skeleton" --body "Implements story 12.1. Admin JWT guard, dashboard, status, maintenance toggle, audit log. All criteria met."
```
