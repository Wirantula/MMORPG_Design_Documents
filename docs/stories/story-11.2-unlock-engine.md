# Story 11.2 — Unlock Engine
**Epic:** 11 | **Role:** Backend Agent | **Status:** Blocked on 11.1 + 10.1 + 6.2

## Problem / intent
New areas and capabilities should unlock when players collectively reach milestones, making world expansion collaborative.

## Acceptance criteria
- [ ] Milestone types: research_completion, infrastructure_build, population_threshold, political_charter
- [ ] Each milestone has: target_node_id, required_conditions_json, current_progress, status
- [ ] Progress updates on relevant domain events (SettlementUnlocked, SkillUnlocked, etc.)
- [ ] Milestone completion unlocks a world node (sets unlock_status = 'open')
- [ ] Public progress broadcast via WebSocket world:unlock_progress event
- [ ] Admin override: PATCH /api/admin/world/milestones/:id/unlock (emergency bypass)
- [ ] Unit tests: progress update, threshold trigger, broadcast, admin override

## Dependencies
- 11.1 ✅  |  10.1 ✅  |  6.2 ✅

## Scope
Only touch: server/src/modules/world/unlock/, server/test/
Do NOT touch: client/, economy/, characters/

## Implementation notes
- world_milestones table: id, target_node_id, type, required_json, progress_json, status
- Event listeners on domain events to update progress
- On completion: update world_nodes.unlock_status, emit broadcast via realtime gateway

## Test notes
server/test/unlock.service.test.ts — progress accumulation, threshold completion, node unlock

## Observability notes
Emit SettlementUnlocked (reuse) or WorldNodeUnlocked domain event

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 11.2 - Unlock Engine.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-11.2-unlock-engine.md && cat server/src/modules/world/world.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create infra/migrations/020_create_world_milestones.sql
  Create server/src/modules/world/unlock/: unlock.service.ts (updateProgress, checkThreshold, broadcastProgress), unlock.controller.ts (admin override)
  Subscribe to domain events to auto-update milestone progress
  On threshold met: set world_nodes.unlock_status = 'open', broadcast via realtime gateway

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/11.2-unlock-engine
  git add server/src/modules/world/unlock/ infra/migrations/020_create_world_milestones.sql server/test/
  git commit -m "feat(11.2): world unlock engine with milestone tracking and broadcast"
  gh pr create --draft --title "feat(11.2): unlock engine" --body "Implements story 11.2. Milestone types, progress tracking, threshold unlock, public broadcast. All criteria met."
```
