# Story 5.2 — Life Stages and Family Protection
**Epic:** 5 | **Role:** Backend Agent | **Status:** Blocked on 5.1 + 4.2

## Problem / intent
New characters start as infants in a protected environment so early life isn't trivially lost.

## Acceptance criteria
- [ ] 5 life stages: infant (0-2), child (3-9), teen (10-14), adult (15-45), elder (46+)
- [ ] Stage transitions are automatic based on in-game age
- [ ] Dangerous actions blocked for infant and child stages
- [ ] Family NPC provides food and shelter for infant/child; neglect triggers safety alert
- [ ] Tutorial prompts fire at each stage transition
- [ ] Unit tests: stage transition, action blocking, family support triggers

## Dependencies
- 5.1 ✅  |  4.2 ✅

## Scope
Only touch: server/src/modules/characters/lifecycle/, server/src/modules/simulation/family/, server/test/
Do NOT touch: economy/, realtime/, client/

## Implementation notes
- Life stage derived from character age (world time delta from born_at)
- Family NPC: household_state JSONB on family row; resolved via tick
- Emit LifeStageTransition domain event

## Test notes
server/test/lifecycle.service.test.ts — stage transitions, blocked actions, family safety alert

## Observability notes
Log LifeStageTransition with character_id and new stage

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 5.2 - Life Stages and Family Protection.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-5.2-life-stages-family-protection.md && cat server/src/modules/simulation/simulation.service.ts && cat server/src/modules/simulation/tick.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create server/src/modules/characters/lifecycle/lifecycle.service.ts: computeLifeStage(), enforceStageRestrictions()
  Create server/src/modules/simulation/family/family.service.ts: resolveFamilySupport(), triggerSafetyAlert()
  Create infra/migrations/004_create_families.sql: families table with household_state JSONB
  Emit LifeStageTransition domain event on stage change
  Wire lifecycle check into tick.service.ts daily tick

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/5.2-life-stages
  git add server/src/modules/characters/lifecycle/ server/src/modules/simulation/family/ infra/migrations/ server/test/
  git commit -m "feat(5.2): life stages state machine and family protection system"
  gh pr create --draft --title "feat(5.2): life stages and family protection" --body "Implements story 5.2. 5 stages, action restrictions, family NPC support, tutorial triggers. All criteria met."
```
