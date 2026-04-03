# Story 14.2 — Inheritance and Property Succession
**Epic:** 14 | **Role:** Backend Agent | **Status:** Blocked on 14.1 + 9.2

## Problem / intent
When a character dies, their property, wealth, and institutional roles must transfer according to designated succession rules so lineage continuity has mechanical weight.

## Acceptance criteria
- [ ] Characters can designate heirs: POST /api/characters/:id/succession
- [ ] On CharacterDied: execute succession — transfer item_instances, currency balance, and contracts to heir
- [ ] If no heir designated: items go to character's settlement treasury; currency sinks 30%
- [ ] Institutional roles (offices, guild leadership) transferred or put to election
- [ ] Succession execution atomic — all transfers in one DB transaction
- [ ] GET /api/characters/:id/succession — view current succession plan
- [ ] Unit tests: heir succession, no-heir sink, institutional role transfer, atomicity

## Dependencies
- 14.1 ✅  |  9.2 ✅

## Scope
Only touch: server/src/modules/lineage/succession/, infra/migrations/, server/test/
Do NOT touch: client/, simulation core/, realtime/

## Implementation notes
- character_succession table: character_id, heir_character_id, updated_at
- Succession handler listens to CharacterDied event
- Use DB transaction to move all assets atomically
- Emit InheritanceExecuted domain event

## Test notes
server/test/succession.service.test.ts — designated heir, no-heir treasury sink, atomicity

## Observability notes
Emit InheritanceExecuted with character_id, heir_id, value_transferred

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 14.2 - Inheritance and Property Succession.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-14.2-inheritance-and-succession.md && cat server/src/modules/lineage/lineage.service.ts && cat server/src/modules/items/items.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create infra/migrations/025_create_succession.sql: character_succession table
  Create server/src/modules/lineage/succession/: succession.service.ts (designateHeir, executeSuccession, sinkNoHeirAssets), succession.controller.ts
  Listen to CharacterDied event: atomically transfer items/currency/roles to heir or sink
  POST /api/characters/:id/succession — designate heir
  GET /api/characters/:id/succession — view plan
  Emit InheritanceExecuted domain event

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/14.2-inheritance
  git add server/src/modules/lineage/succession/ infra/migrations/025_create_succession.sql server/test/
  git commit -m "feat(14.2): inheritance and property succession on permadeath"
  gh pr create --draft --title "feat(14.2): inheritance and property succession" --body "Implements story 14.2. Heir designation, atomic asset transfer, no-heir treasury sink. All criteria met."
```
