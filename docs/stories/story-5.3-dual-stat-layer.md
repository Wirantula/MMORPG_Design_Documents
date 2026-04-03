# Story 5.3 — Dual Stat Layer System
**Epic:** 5 | **Role:** Backend Agent | **Status:** Blocked on 5.1 + 4.2

## Problem / intent
Characters have visible stats (current capability) and hidden potential stats (growth ceiling, learning efficiency, scenario bias) to make lives asymmetric.

## Acceptance criteria
- [ ] Visible stat families: Physical (STR/AGI/END/REC), Mental (INT/FOC/CRE/MEM), Social (CHA/AUT/EMP/DEC), Perceptual (AWR/PRE/INS), Spiritual (WIL/RES/AET), Economic (APR/NEG/LOG)
- [ ] Hidden potential families: growth_elasticity, ceiling_bias, fortune_bias, craft_intuition, combat_instinct, research_spark, trauma_susceptibility (all 0–100)
- [ ] All stats 0–1,000,000; level 100 = peak human
- [ ] Hidden layer is server-only; never serialised in player-facing API responses
- [ ] Admin debug endpoint GET /api/admin/characters/:id/potential returns full hidden layer
- [ ] Unit tests: stat initialisation from wheel results, hidden layer not in player API response

## Dependencies
- 5.1 ✅  |  4.2 ✅

## Scope
Only touch: server/src/modules/characters/stats/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, realtime/

## Implementation notes
- Tables: character_current_stats, character_potential_stats (separate rows, same character_id FK)
- Stats stored as JSONB columns per family for flexibility
- Initialise stats from wheel_results via a stat-seeding function

## Test notes
server/test/stats.service.test.ts — initialisation, hidden layer exclusion from player DTO

## Observability notes
Log stat initialisation with character_id and stat family counts

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 5.3 - Dual Stat Layer System.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-5.3-dual-stat-layer.md && cat server/src/modules/characters/characters.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create server/src/modules/characters/stats/: stat.types.ts (all stat families + hidden potential types), stat.service.ts (initStats, getVisibleStats, getPotentialStats), stat.constants.ts (PEAK_HUMAN = 100)
  Create infra/migrations/005_create_character_stats.sql: character_current_stats + character_potential_stats tables with JSONB columns
  Ensure hidden potential never appears in player-facing GET /api/characters/:id response
  Admin endpoint GET /api/admin/characters/:id/potential — RBAC-gated, returns full hidden layer

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/5.3-dual-stat-layer
  git add server/src/modules/characters/stats/ infra/migrations/005_create_character_stats.sql server/test/
  git commit -m "feat(5.3): dual stat layer — visible stats and hidden potential"
  gh pr create --draft --title "feat(5.3): dual stat layer system" --body "Implements story 5.3. Visible stats (6 families), hidden potential (7 values), migration 005, admin debug endpoint. All criteria met."
```
