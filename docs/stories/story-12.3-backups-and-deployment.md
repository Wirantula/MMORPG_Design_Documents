# Story 12.3 — Backups, Restore and Deployment Controls
**Epic:** 12 | **Role:** Live Ops Agent | **Status:** Blocked on 12.1

## Problem / intent
The host needs operational safeguards to recover from mistakes or failures with confidence.

## Acceptance criteria
- [ ] Backup script: pg_dump to infra/backups/ with timestamp filename, runs daily
- [ ] Retention: keep last 7 daily and last 4 weekly backups; delete older
- [ ] GET /api/admin/ops/backups: list available backups with size and timestamp
- [ ] Restore dry-run: POST /api/admin/ops/restore/dry-run validates backup file integrity
- [ ] GET /api/admin/ops/version: returns current git commit hash and deploy timestamp
- [ ] Migration check: server startup validates all migrations applied before accepting requests
- [ ] Runbook: docs/RUNBOOKS/BACKUP_RESTORE.md documents full restore procedure
- [ ] Unit tests: retention policy deletion, backup listing

## Dependencies
- 12.1 ✅

## Scope
Only touch: server/src/modules/ops/, tools/scripts/backup.sh, docs/RUNBOOKS/, infra/backups/.gitkeep, server/test/
Do NOT touch: client/, economy/, characters/

## Implementation notes
- backup.sh: pg_dump with PGPASSWORD from env, output to infra/backups/backup_{timestamp}.sql.gz
- Retention: find infra/backups/ -mtime +7 and keep weekly snapshots separately
- Migration check: at app startup, query pg_migrations table vs expected count

## Test notes
server/test/ops.service.test.ts — retention logic, listing, dry-run validation

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Live Ops Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 12.3 - Backups, Restore and Deployment Controls.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-12.3-backups-and-deployment.md && cat server/src/main.ts

STEP 2 - Implement:
  Create tools/scripts/backup.sh: pg_dump with timestamp, gzip, retention policy
  Create infra/backups/.gitkeep
  Create server/src/modules/ops/: ops.module.ts, ops.service.ts (listBackups, dryRunRestore, getVersion, checkMigrations), ops.controller.ts
  GET /api/admin/ops/backups, POST /api/admin/ops/restore/dry-run, GET /api/admin/ops/version
  Add migration check to main.ts startup sequence
  Create docs/RUNBOOKS/BACKUP_RESTORE.md with step-by-step restore procedure

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/12.3-backups-ops
  git add server/src/modules/ops/ tools/scripts/backup.sh infra/backups/.gitkeep docs/RUNBOOKS/BACKUP_RESTORE.md server/test/
  git commit -m "feat(12.3): backup scripts, restore dry-run, deployment controls, runbook"
  gh pr create --draft --title "feat(12.3): backups and deployment controls" --body "Implements story 12.3. Daily pg_dump, retention, dry-run restore, version endpoint, migration check, runbook. All criteria met."
```
