# Story 12.2 — Moderation Tooling
**Epic:** 12 | **Role:** Backend Agent | **Status:** Blocked on 12.1

## Problem / intent
Moderators need report queues and sanction tools so community harm can be managed efficiently.

## Acceptance criteria
- [ ] POST /api/moderation/reports: player submits report (target_id, reason, evidence_text)
- [ ] GET /api/admin/moderation/reports: paginated queue for moderators
- [ ] PATCH /api/admin/moderation/reports/:id: resolve report with action (warn|mute|ban|note)
- [ ] Warn: adds warning to account; Mute: sets muted_until; Ban: sets banned = true
- [ ] All moderation actions written to admin_audit_log
- [ ] Unit tests: report creation, each sanction type, audit log write

## Dependencies
- 12.1 ✅

## Scope
Only touch: server/src/modules/moderation/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, characters/

## Implementation notes
- player_reports table: id, reporter_id, target_id, reason, evidence_text, status, resolved_by, created_at
- Add muted_until, warning_count columns to accounts (migration)
- Mute broadcasts disconnection to target's WS session

## Test notes
server/test/moderation.service.test.ts — report lifecycle, all sanction types

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 12.2 - Moderation Tooling.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-12.2-moderation-tooling.md && cat server/src/modules/admin/admin.service.ts

STEP 2 - Implement:
  Create infra/migrations/023_create_moderation.sql: player_reports; add muted_until, warning_count to accounts
  Create server/src/modules/moderation/: moderation.module.ts, moderation.service.ts, moderation.controller.ts
  POST /api/moderation/reports, GET /api/admin/moderation/reports, PATCH /api/admin/moderation/reports/:id
  Implement warn/mute/ban sanctions; write all actions to admin_audit_log

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/12.2-moderation
  git add server/src/modules/moderation/ infra/migrations/023_create_moderation.sql server/test/
  git commit -m "feat(12.2): moderation tooling with report queue and sanctions"
  gh pr create --draft --title "feat(12.2): moderation tooling" --body "Implements story 12.2. Report intake, moderation queue, warn/mute/ban, audit trail. All criteria met."
```
