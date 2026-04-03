# Story 10.1 — Settlement Project System
**Epic:** 10 | **Role:** Backend Agent | **Status:** Blocked on 8.2 + 9.2

## Problem / intent
Communities need to build shared infrastructure so locations can evolve and matter strategically.

## Acceptance criteria
- [ ] Project types: housing, workshop, governance_hub, defence_wall (data-driven)
- [ ] Projects have milestones with material + labour requirements
- [ ] Players contribute items and labour actions toward milestones
- [ ] Milestone completion broadcasts public progress event
- [ ] Completed projects unlock capabilities (e.g. completed workshop unlocks 8.3 station)
- [ ] GET /api/settlements/:id/projects and POST /api/settlements/:id/projects/:id/contribute
- [ ] Unit tests: contribution, milestone completion, capability unlock

## Dependencies
- 8.2 ✅  |  9.2 ✅

## Scope
Only touch: server/src/modules/settlements/, tools/content/projects.json, infra/migrations/, server/test/
Do NOT touch: client/, economy market/, simulation core/

## Implementation notes
- settlements table: id, name, founded_by, world_node_id, founded_at
- settlement_projects table: id, settlement_id, type, status, milestone_data_json
- Emit SettlementUnlocked domain event when project completes

## Test notes
server/test/settlement-project.service.test.ts — contribute, milestone complete, unlock event

## Observability notes
Emit SettlementUnlocked with settlement_id and project_type

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 10.1 - Settlement Project System.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-10.1-settlement-project-system.md && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create tools/content/projects.json: 4 project types with milestone requirements
  Create infra/migrations/016_create_settlements.sql: settlements + settlement_projects
  Create server/src/modules/settlements/: settlements.module.ts, settlements.service.ts, projects.service.ts, settlements.controller.ts
  POST /api/settlements/:id/projects/:id/contribute, GET /api/settlements/:id/projects
  Emit SettlementUnlocked on project completion

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/10.1-settlement-projects
  git add server/src/modules/settlements/ tools/content/projects.json infra/migrations/016_create_settlements.sql server/test/
  git commit -m "feat(10.1): settlement project system with milestones and capability unlocks"
  gh pr create --draft --title "feat(10.1): settlement project system" --body "Implements story 10.1. 4 project types, milestones, contributions, SettlementUnlocked event. All criteria met."
```
