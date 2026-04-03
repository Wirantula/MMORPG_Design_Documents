# Story 22.1 — Integrity Checks and Audit Jobs
**Epic:** 22 | **Role:** Live Ops Agent + QA Agent | **Status:** Blocked on 9.1 + 8.1

## Problem / intent
Periodic integrity checks catch item duplication, orphan listings, and broken references before they corrupt the economy or frustrate players.

## Acceptance criteria
- [ ] Scheduled integrity job runs every in-game day (via batch tick)
- [ ] Check 1 — Item dupe detection: any item_instance_id referenced by > 1 owner
- [ ] Check 2 — Orphan listings: market_listings with no valid item_instance_id
- [ ] Check 3 — Broken references: character_skills referencing non-existent skill_ids
- [ ] Check 4 — Wallet invariant: sum of all transfers for each character equals their wallet balance
- [ ] All violations logged to integrity_violations table with severity and auto-quarantine flag
- [ ] GET /api/admin/integrity/violations — admin view of flagged issues
- [ ] Unit tests: each check with seeded violation data

## Dependencies
- 9.1 ✅  |  8.1 ✅

## Scope
Only touch: server/src/modules/integrity/, infra/migrations/, server/test/

## Implementation notes
- integrity_violations table: id, check_name, entity_type, entity_id, severity, details_json, detected_at, resolved_at
- Wire integrity job into batch/archival tick (not daily game tick — run as scheduled job)
- Auto-quarantine: set item_instance.quarantined = true on dupe detection

## Test notes
server/test/integrity.service.test.ts — seed each violation type, assert detection and log

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Live Ops Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 22.1 - Integrity Checks and Audit Jobs.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-22.1-integrity-checks-and-audit-jobs.md && cat server/src/modules/simulation/tick.service.ts && cat server/src/modules/items/items.service.ts

STEP 2 - Implement:
  Create infra/migrations/036_create_integrity_violations.sql: integrity_violations table + quarantined column on item_instances
  Create server/src/modules/integrity/: integrity.module.ts, integrity.service.ts (checkItemDupes, checkOrphanListings, checkBrokenRefs, checkWalletInvariant, runAllChecks), integrity.controller.ts
  Wire runAllChecks() into tick.service.ts batch/archival scheduled job
  Auto-quarantine duplicated item_instances
  GET /api/admin/integrity/violations — admin only, paginated

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/22.1-integrity-checks
  git add server/src/modules/integrity/ infra/migrations/036_create_integrity_violations.sql server/test/
  git commit -m "feat(22.1): scheduled integrity checks for dupes, orphans, broken refs, wallet invariants"
  gh pr create --draft --title "feat(22.1): integrity checks and audit jobs" --body "Implements story 22.1. 4 integrity check types, violations table, auto-quarantine, admin view. All criteria met."
```
