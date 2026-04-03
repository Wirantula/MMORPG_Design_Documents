# Story 7.1 — Needs System
**Epic:** 7 | **Role:** Backend Agent | **Status:** Blocked on 4.2 + 5.2

## Problem / intent
Hunger, sleep, hygiene, morale, and belonging must matter so routine choices become meaningful.

## Acceptance criteria
- [ ] 5 need dimensions: nutrition, fatigue, hygiene, morale, belonging (each 0–100)
- [ ] Needs decay at configured rates per in-game day via daily tick
- [ ] Need level modifies action outcome quality and XP gain (−30% at critical, +10% at full)
- [ ] Critical needs (< 10) trigger warnings visible to player
- [ ] GET /api/characters/:id/needs returns current need levels with status labels
- [ ] Routines can include need-recovery actions (eat, sleep, socialise)
- [ ] Unit tests: decay rates, modifier application, critical warning trigger

## Dependencies
- 4.2 ✅  |  5.2 ✅

## Scope
Only touch: server/src/modules/needs/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, realtime/

## Implementation notes
- character_needs table: character_id, nutrition, fatigue, hygiene, morale, belonging, updated_at
- Decay wired into tick.service.ts daily tick
- Modifier hook: NeedsService.getModifier(characterId) → multiplier used by action.service.ts

## Test notes
server/test/needs.service.test.ts — decay after N ticks, modifier at critical/full, warning fire

## Observability notes
Log critical need warnings with character_id and need dimension

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 7.1 - Needs System.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-7.1-needs-system.md && cat server/src/modules/simulation/tick.service.ts && cat server/src/modules/simulation/actions/action.service.ts

STEP 2 - Implement:
  Create infra/migrations/009_create_character_needs.sql
  Create server/src/modules/needs/: needs.module.ts, needs.service.ts (decayNeeds, getModifier, getNeedsStatus, triggerWarnings), needs.controller.ts
  Wire decayNeeds() into tick.service.ts daily tick
  Apply getModifier() multiplier in action.service.ts outcome resolution
  GET /api/characters/:id/needs: current values with status labels (critical/low/ok/full)

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/7.1-needs-system
  git add server/src/modules/needs/ infra/migrations/009_create_character_needs.sql server/test/
  git commit -m "feat(7.1): needs system — nutrition/fatigue/hygiene/morale/belonging with decay and modifiers"
  gh pr create --draft --title "feat(7.1): needs system" --body "Implements story 7.1. 5 need dimensions, daily decay, action modifier hook, critical warnings. All criteria met."
```
