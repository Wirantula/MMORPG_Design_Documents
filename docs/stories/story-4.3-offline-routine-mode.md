# Story 4.3 — Offline Routine Mode
**Epic:** 4 | **Role:** Backend Agent | **Status:** Review ✅ (implemented)

## Problem / intent
Characters should follow routines while the player is offline so the game stays playable.

## Acceptance criteria
- [x] Characters can have up to 3 routine slots (actionType + priority)
- [x] Offline processing runs at 60% efficiency vs active play
- [x] Routine processing skips if needs (hunger/fatigue) are critical
- [x] Dangerous actions blocked for infant/child life stages
- [x] On next login, player receives OfflineReport: duration, actions_completed, xp_earned, needs_changes, warnings
- [ ] Routine state persisted per character (deferred — requires persistence layer)
- [x] Unit tests: routine execution, safety defaults, efficiency penalty, report generation

## Dependencies
- 4.2 ✅

## Scope
Only touch: server/src/modules/simulation/routines/, server/src/modules/simulation/simulation.module.ts, server/test/
Do NOT touch: client/, auth/, characters/

## Implementation notes
- Create routine.types.ts: RoutineSlot, OfflineReport types
- Create routine.service.ts: processOfflineRoutines(), generateOfflineReport()
- 0.6 efficiency multiplier on XP and output rewards
- Emit OfflineReportGenerated domain event
- offline_since timestamp stored on character state, cleared on login

## Test notes
server/test/routine.service.test.ts — 3 slots, blocked dangerous action, report content

## Observability notes
Log routine start/end with character_id and action count. Metric: offline_routines_processed_total

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Backend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 4.3 - Offline Routine Mode.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-4.3-offline-routine-mode.md && cat server/src/modules/simulation/simulation.service.ts && cat server/src/modules/simulation/tick.service.ts && cat server/src/modules/simulation/actions/action.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create server/src/modules/simulation/routines/routine.types.ts: RoutineSlot, OfflineReport interfaces
  Create server/src/modules/simulation/routines/routine.service.ts: processOfflineRoutines(), generateOfflineReport()
  Apply 0.6 efficiency multiplier for offline XP and outputs
  Block dangerous actions for infant/child stages; skip steps when needs critical
  Emit OfflineReportGenerated domain event; store offline_since on character
  Register RoutineService in simulation.module.ts

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/4.3-offline-routine
  git add server/src/modules/simulation/routines/ server/src/modules/simulation/simulation.module.ts server/test/
  git commit -m "feat(4.3): offline routine mode with 60% efficiency and safety defaults"
  gh pr create --draft --title "feat(4.3): offline routine mode" --body "Implements story 4.3. Routine slots, offline processing at 60% efficiency, OfflineReport generation. All criteria met."
```
