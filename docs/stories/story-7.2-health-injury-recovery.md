# Story 7.2 — Health, Injury and Recovery
**Epic:** 7 | **Role:** Backend Agent | **Status:** Blocked on 7.1

## Problem / intent
Wounds and illness create consequences beyond hit points, requiring treatment and recovery time.

## Acceptance criteria
- [ ] Health condition types: wound (severity 1-5), illness (acute/chronic), exhaustion, poisoning
- [ ] Each condition has: duration_days, stat_penalty_modifier, recovery_action_required
- [ ] Conditions stack with diminishing severity
- [ ] Treatment linked to profession skills (e.g. Surgery reduces wound recovery time 50%)
- [ ] Early-life safety: no lethal conditions for infant/child stages
- [ ] GET /api/characters/:id/health returns active conditions with recovery prognosis
- [ ] Unit tests: condition application, stacking, treatment reduction, infant safety

## Dependencies
- 7.1 ✅

## Scope
Only touch: server/src/modules/health/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, realtime/

## Implementation notes
- character_conditions table: id, character_id, type, severity, started_at, resolves_at, treated_by_skill
- Conditions checked each tick; expired ones auto-resolved

## Test notes
server/test/health.service.test.ts — wound → treatment → recovery timeline

## Observability notes
Log condition applied/resolved with character_id, type, severity

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 7.2 - Health, Injury and Recovery.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-7.2-health-injury-recovery.md && cat server/src/modules/needs/needs.service.ts && cat server/src/modules/simulation/tick.service.ts

STEP 2 - Implement:
  Create infra/migrations/010_create_character_conditions.sql
  Create server/src/modules/health/: health.module.ts, health.service.ts (applyCondition, resolveCondition, getTreatmentReduction, checkInfantSafety), health.controller.ts
  Wire condition resolution into tick.service.ts
  GET /api/characters/:id/health: active conditions with recovery prognosis
  Block lethal conditions for infant/child life stages

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/7.2-health-injury
  git add server/src/modules/health/ infra/migrations/010_create_character_conditions.sql server/test/
  git commit -m "feat(7.2): health conditions, injury, recovery with profession treatment"
  gh pr create --draft --title "feat(7.2): health, injury and recovery" --body "Implements story 7.2. Condition types, stacking, treatment reductions, infant safety. All criteria met."
```
